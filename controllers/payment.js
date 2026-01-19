const Payment = require('../models/payment');
const Order = require('../models/order');
const sequelize = require('../util/database');
const paypalClient = require('../util/paypal-client');
const { QueryTypes } = require('sequelize');
const crypto = require('crypto');

async function tryCreatePaymentFallback(data) {
  // Attempt to insert using whatever columns actually exist in the DB
  try {
    // fetch column names + types for payments table
    const colsRes = await sequelize.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'payments'`, { type: QueryTypes.SELECT });
    const existingCols = Array.isArray(colsRes) ? colsRes.map(r => r.column_name) : [];
    const colTypes = {};
    colsRes.forEach(r => { colTypes[r.column_name] = r.data_type; });

    if (!existingCols || existingCols.length === 0) {
      console.warn('tryCreatePaymentFallback: no payments columns detected');
      return null;
    }

    // Determine values to insert using available columns
    const payload = {}
    // prefer explicit paymentId, else use metadata.id (PayPal order id), else generate uuid
    const resolvedPaymentId = data.paymentId || (data.metadata && data.metadata.id) || crypto.randomUUID();

    if (existingCols.includes('payment_id')) payload.payment_id = resolvedPaymentId;
    if (existingCols.includes('paymentId')) payload.paymentId = resolvedPaymentId;

    if (existingCols.includes('transaction_id')) payload.transaction_id = data.transactionId || null;
    if (existingCols.includes('transactionId')) payload.transactionId = data.transactionId || null;

    // -- order linkage: ensure we have a numeric orderId if DB requires it
    const resolvedOrderId = data.orderId || null;
    let ensuredOrderId = null;
    if (resolvedOrderId !== null) {
      const asInt = parseInt(resolvedOrderId, 10);
      if (!Number.isNaN(asInt)) ensuredOrderId = asInt;
    }

    // If payments table requires orderId (not nullable) and we don't have one, create a minimal placeholder order
    const orderColInfo = colsRes.find(r => r.column_name === 'orderId');
    const orderIdRequired = orderColInfo && orderColInfo.is_nullable === 'NO';
    if (!ensuredOrderId && orderIdRequired) {
      try {
        const Order = require('../models/order');
        const placeholder = await Order.create({ totalAmount: 0.00, currency: data.currency || 'GBP', status: 'Created', userId: null });
        ensuredOrderId = placeholder.id;
        console.log('tryCreatePaymentFallback: created placeholder order id=', ensuredOrderId);
      } catch (ordErr) {
        console.warn('tryCreatePaymentFallback: failed to create placeholder order to satisfy orderId NOT NULL constraint', ordErr && ordErr.message);
      }
    }

    if (ensuredOrderId !== null) {
      if (existingCols.includes('order_id')) payload.order_id = ensuredOrderId;
      if (existingCols.includes('orderId')) payload.orderId = ensuredOrderId;
    }

    if (existingCols.includes('amount')) {
      // ensure numeric
      const num = Number(data.amount || 0);
      payload.amount = Number.isNaN(num) ? 0 : num;
    }
    if (existingCols.includes('currency')) payload.currency = data.currency || 'GBP';
    if (existingCols.includes('status')) payload.status = data.status || 'Pending';
    if (existingCols.includes('payment_method')) payload.payment_method = data.paymentMethod || 'PayPal';
    if (existingCols.includes('paymentMethod')) payload.paymentMethod = data.paymentMethod || 'PayPal';

    if (existingCols.includes('metadata')) {
      // store JSON if column supports it, otherwise stringify
      const dt = colTypes['metadata'] || '';
      if (dt && (dt === 'json' || dt === 'jsonb')) payload.metadata = data.metadata || {};
      else payload.metadata = JSON.stringify(data.metadata || {});
    }
    if (existingCols.includes('payer_email')) payload.payer_email = data.payerEmail || null;
    if (existingCols.includes('payerName')) payload.payerName = data.payerName || null;
    if (existingCols.includes('payer_name')) payload.payer_name = data.payerName || null;

    // timestamps: try camelCase, snake_case, or omit
    const now = new Date();
    if (existingCols.includes('createdAt')) payload.createdAt = now;
    if (existingCols.includes('updatedAt')) payload.updatedAt = now;
    if (existingCols.includes('created_at')) payload.created_at = now;
    if (existingCols.includes('updated_at')) payload.updated_at = now;

    // Build insert
    const keys = Object.keys(payload);
    if (keys.length === 0) {
      console.warn('tryCreatePaymentFallback: nothing to insert (no matching columns)');
      return null;
    }

    // Sanitize/coerce values based on detected column types to avoid SQL type errors
    const coercedValues = keys.map(k => {
      let v = payload[k];
      if (v === 'default' || v === 'DEFAULT') return null;
      const dt = colTypes[k] || '';
      if (!v && v !== 0 && v !== false) return null;
      if (dt.includes('int')) {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      }
      if (dt === 'numeric' || dt === 'decimal') {
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      }
      if (dt.includes('timestamp') || dt === 'date' || dt === 'timestamp without time zone' || dt === 'timestamp with time zone') {
        return (v instanceof Date) ? v : new Date(v);
      }
      if (dt === 'boolean') return !!v;
      // leave JSON / text / varchar as-is; if JSON column and value is object, keep object
      if ((dt === 'json' || dt === 'jsonb') && typeof v === 'object') return v;
      return v;
    });

    const values = coercedValues;
    const placeholders = values.map((v, i) => `$${i+1}`).join(',');
    const colsSql = keys.map(k => `"${k}"`).join(',');
    const sql = `INSERT INTO "payments"(${colsSql}) VALUES(${placeholders}) RETURNING id`;

    const result = await sequelize.query(sql, { bind: values, type: QueryTypes.INSERT });
    // try to return inserted id from common result shapes
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0];
      if (Array.isArray(first) && first.length > 0 && first[0].id) return first[0].id;
      if (first && first.id) return first.id;
    }
    return null;
  } catch (err) {
    console.warn('tryCreatePaymentFallback generic failure', err && (err.message || err));
    return null;
  }
}

// Start payment - create PayPal order and return approval URL
exports.startPayment = async (req, res) => {
  try {
    console.log('POST /payment/create called; body=', JSON.stringify(req.body || {}), 'sessionId=', req.sessionID, 'userId=', req.user && req.user.id);
    const { orderId, amount, currency } = req.body;

    let order = null;
    let purchaseAmount = null;
    // Default currency set to GBP as requested
    let purchaseCurrency = 'GBP';

    if (orderId) {
      order = await Order.findByPk(orderId);
      if (!order) {
        console.warn('startPayment: orderId provided but order not found:', orderId);
        return res.status(404).json({ error: 'Order not found' });
      }
      purchaseAmount = Number(order.totalAmount).toFixed(2);
      purchaseCurrency = order.currency || 'GBP';
    } else {
      // Fallback: allow amount and currency directly
      if (!amount) {
        return res.status(400).json({ error: 'orderId or amount required' });
      }
      purchaseAmount = Number(amount).toFixed(2);
      purchaseCurrency = (currency || 'GBP').toUpperCase();
    }

    // Build purchase units
    const purchaseUnits = [{
      reference_id: order ? String(order.id) : null,
      amount: {
        currency_code: purchaseCurrency,
        value: purchaseAmount
      }
    }];

    console.log('startPayment: creating PayPal order for amount=', purchaseAmount, purchaseCurrency, 'reference=', purchaseUnits[0].reference_id);

    const client = paypalClient.getClient();
    const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest)();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: purchaseUnits,
      application_context: {
        brand_name: 'Book Lab Store',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${req.protocol}://${req.get('host')}/payment/success${order ? ('?orderId=' + order.id) : ''}`,
        cancel_url: `${req.protocol}://${req.get('host')}/payment/cancel${order ? ('?orderId=' + order.id) : ''}`
      }
    });

    let createResp;
    try {
      createResp = await client.execute(request);
    } catch (paypalErr) {
      console.error('startPayment: PayPal API call failed', paypalErr && (paypalErr.statusCode || paypalErr.message || paypalErr));
      // Include any response body if available (sdk sometimes attaches statusCode and message)
      const detail = (paypalErr && (paypalErr.message || paypalErr.statusCode)) || String(paypalErr);
      return res.status(502).json({ error: 'Failed to create PayPal order', detail });
    }
    if (!createResp || !createResp.result) {
      console.error('startPayment: invalid response from PayPal', createResp);
      // If createResp exists, return it for debugging in dev
      return res.status(502).json({ error: 'Failed to create PayPal order', detail: createResp || 'no_response' });
    }

    const approvalUrl = (createResp.result && createResp.result.links || []).find(l => l.rel === 'approve');

    // Create Payment record in DB (pending)
    try {
      const paymentPayload = {
        paymentId: createResp.result.id,
        transactionId: null,
        amount: purchaseAmount,
        currency: purchaseCurrency,
        status: 'Pending',
        paymentMethod: 'PayPal',
        payerEmail: null,
        payerName: null,
        processedAt: null,
        metadata: createResp.result
      };
      // only include orderId if we have a real order
      if (order && order.id) paymentPayload.orderId = order.id;

      const paymentRecord = await Payment.create(paymentPayload);

      console.log('startPayment: Payment record created id=', paymentRecord.id, 'paypalOrderId=', createResp.result.id);
      return res.status(200).json({ message: 'Payment created', approvalUrl: (approvalUrl ? approvalUrl.href : null), paypalOrder: createResp.result, paymentId: paymentRecord.id });
    } catch (dbErr) {
      console.error('startPayment: failed to persist Payment record', dbErr && (dbErr.stack || dbErr.message || dbErr));
      // Try a lightweight fallback insert to at least create a DB row with minimal fields
      const fallbackId = await tryCreatePaymentFallback({ paymentId: createResp.result.id, orderId: order ? order.id : null, amount: purchaseAmount, currency: purchaseCurrency, status: 'Pending', paymentMethod: 'PayPal', metadata: createResp.result });
      if (fallbackId) {
        console.log('startPayment: fallback created payment id=', fallbackId);
        return res.status(200).json({ message: 'Payment created (fallback)', approvalUrl: (approvalUrl ? approvalUrl.href : null), paypalOrder: createResp.result, paymentId: fallbackId, paymentSaved: 'fallback' });
      }
      return res.status(200).json({ message: 'Payment created (unpersisted)', approvalUrl: (approvalUrl ? approvalUrl.href : null), paypalOrder: createResp.result, paymentSaved: false, detail: dbErr && dbErr.message ? dbErr.message : String(dbErr) });
    }
  } catch (err) {
    console.error('startPayment error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Failed to start payment', detail: err && (err.message || String(err)) });
  }
};

exports.paymentSuccess = async (req, res) => {
  try {
    // PayPal will redirect here with token/orderID in query
    const { token, orderId } = req.query; // token is PayPal order ID
    if (!token) return res.status(400).render('500', { error: 'Missing PayPal token' });

    const client = paypalClient.getClient();
    const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest)(token);
    request.requestBody({});

    const captureResp = await client.execute(request);

    // Find payment record by paymentId
    const paymentRecord = await Payment.findOne({ where: { paymentId: token } });
    if (paymentRecord) {
      paymentRecord.transactionId = (captureResp.result.purchase_units && captureResp.result.purchase_units[0].payments && captureResp.result.purchase_units[0].payments.captures && captureResp.result.purchase_units[0].payments.captures[0].id) || null;
      paymentRecord.status = 'Completed';
      paymentRecord.processedAt = new Date();
      paymentRecord.payerEmail = (captureResp.result.payer && captureResp.result.payer.email_address) || null;
      paymentRecord.payerName = (captureResp.result.payer && captureResp.result.payer.name && (captureResp.result.payer.name.given_name + ' ' + (captureResp.result.payer.name.surname || ''))) || null;
      paymentRecord.metadata = captureResp.result;
      await paymentRecord.save();

      // Update linked Order status to Paid and clear user's cart if applicable
      try {
        const linkedOrder = paymentRecord.orderId ? await Order.findByPk(paymentRecord.orderId) : null;
        if (linkedOrder) {
          linkedOrder.status = 'Paid';
          await linkedOrder.save();
          // If order belongs to a user, clear their cart
          if (linkedOrder.userId) {
            const user = await linkedOrder.getUser();
            if (user && typeof user.getCart === 'function') {
              const cart = await user.getCart();
              if (cart) await cart.setProducts(null);
            }
          }
        }
      } catch (ordErr) {
        console.warn('Failed to update linked order after capture:', ordErr);
      }
    }

    // TODO: update linked Order status to Paid

    return res.render('payment/success', { pageTitle: 'Payment Success', path: '/payment/success', paypal: captureResp.result });
  } catch (err) {
    console.error('paymentSuccess error:', err);
    return res.status(500).render('500', { error: 'Payment success handler failed' });
  }
};

exports.paymentCancel = async (req, res) => {
  try {
    res.render('payment/cancel', { pageTitle: 'Payment Cancelled', path: '/payment/cancel' });
  } catch (err) {
    console.error('paymentCancel error:', err);
    res.status(500).render('500', { error: 'Payment cancel handler failed' });
  }
};

// Create payment (alias of start)
exports.postCreatePayment = async (req, res) => {
  return exports.startPayment(req, res);
};

// Execute payment (capture) - in case frontend calls server to capture
exports.postExecutePayment = async (req, res) => {
  try {
    const { token } = req.body; // PayPal order ID
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const client = paypalClient.getClient();
    const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest)(token);
    request.requestBody({});

    const captureResp = await client.execute(request);

    // Update payment record
    const paymentRecord = await Payment.findOne({ where: { paymentId: token } });
    if (paymentRecord) {
      paymentRecord.transactionId = (captureResp.result.purchase_units && captureResp.result.purchase_units[0].payments && captureResp.result.purchase_units[0].payments.captures && captureResp.result.purchase_units[0].payments.captures[0].id) || null;
      paymentRecord.status = 'Completed';
      paymentRecord.processedAt = new Date();
      paymentRecord.payerEmail = (captureResp.result.payer && captureResp.result.payer.email_address) || null;
      paymentRecord.payerName = (captureResp.result.payer && captureResp.result.payer.name && (captureResp.result.payer.name.given_name + ' ' + (captureResp.result.payer.name.surname || ''))) || null;
      paymentRecord.metadata = captureResp.result;
      await paymentRecord.save();

      // Mark order as paid and clear user cart
      try {
        const linkedOrder = paymentRecord.orderId ? await Order.findByPk(paymentRecord.orderId) : null;
        if (linkedOrder) {
          linkedOrder.status = 'Paid';
          await linkedOrder.save();
          if (linkedOrder.userId) {
            const user = await linkedOrder.getUser();
            if (user && typeof user.getCart === 'function') {
              const cart = await user.getCart();
              if (cart) await cart.setProducts(null);
            }
          }
        }
      } catch (ordErr) {
        console.warn('postExecutePayment: failed to update order after capture', ordErr);
      }
    }

    res.status(200).json({ message: 'Payment executed', capture: captureResp.result });
  } catch (err) {
    console.error('postExecutePayment error:', err);
    res.status(500).json({ error: 'Failed to execute payment' });
  }
};

// PayPal webhook handler
exports.postPayPalWebhook = async (req, res) => {
  try {
    console.log('Received PayPal webhook:', req.body && req.body.event_type);
    // TODO: verify webhook signature using PayPal SDK and update Payment/Order accordingly
    res.status(200).send('OK');
  } catch (err) {
    console.error('postPayPalWebhook error:', err);
    res.status(500).send('ERROR');
  }
};

// Get payment by order id (read from payments table)
exports.getPaymentByOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const payment = await Payment.findOne({ where: { metadata: { reference_id: String(orderId) } } });
    return res.status(200).json({ payment });
  } catch (err) {
    console.error('getPaymentByOrder error:', err);
    res.status(500).json({ error: 'Failed to retrieve payment' });
  }
};

exports.getTransactionsPage = async (req, res) => {
  try {
    let transactions = [];
    if (Payment && typeof Payment.findAll === 'function') {
      try {
        transactions = await Payment.findAll({ order: [['createdAt','DESC']], limit: 100 });
      } catch (dbErr) {
        console.warn('getTransactionsPage: Payment.findAll failed, rendering empty list. Error:', dbErr && dbErr.message);
        transactions = [];
      }
    }
    try {
      return res.render('payment/transactions', { pageTitle: 'Transactions', path: '/payment/transactions', transactions });
    } catch (renderErr) {
      console.error('getTransactionsPage render error:', renderErr);
      const rows = (transactions || []).map(t => (`<li>${t.paymentId || t.id} - $${Number(t.amount||0).toFixed(2)} - ${t.status}</li>`)).join('') || '<li>No transactions</li>';
      return res.send(`<h1>Transactions</h1><ul>${rows}</ul>`);
    }
  } catch (err) {
    console.error('getTransactionsPage error:', err);
    try {
      return res.render('payment/transactions', { pageTitle: 'Transactions', path: '/payment/transactions', transactions: [] });
    } catch (finalErr) {
      console.error('Final fallback render failed:', finalErr);
      return res.send('<h1>Transactions (unavailable)</h1>');
    }
  }
};

exports.getReportsPage = async (req, res) => {
  try {
    const totalRevenue = await Order.sum('totalAmount') || 0;
    const transactionCount = await Order.count();
    res.render('payment/reports', { pageTitle: 'Payment Reports', path: '/payment/reports', totalRevenue, transactionCount });
  } catch (err) {
    console.error('getReportsPage error:', err);
    res.status(500).render('500', { error: 'Failed to load reports' });
  }
};

exports.getReconciliationPage = async (req, res) => {
  try {
    let transactions = [];
    if (Payment && typeof Payment.findAll === 'function') {
      transactions = await Payment.findAll({ order: [['createdAt','DESC']], limit: 200 });
    }
    res.render('payment/reconciliation', { pageTitle: 'Reconciliation', path: '/payment/reconciliation', transactions });
  } catch (err) {
    console.error('getReconciliationPage error:', err);
    res.status(500).render('500', { error: 'Failed to load reconciliation' });
  }
};

exports.getRefundsPage = async (req, res) => {
  try {
    let refunds = [];
    if (Payment && typeof Payment.findAll === 'function') {
      refunds = await Payment.findAll({ where: { status: 'Refunded' }, order: [['createdAt','DESC']], limit: 200 });
    }
    res.render('payment/refunds', { pageTitle: 'Refunds', path: '/payment/refunds', refunds });
  } catch (err) {
    console.error('getRefundsPage error:', err);
    res.status(500).render('500', { error: 'Failed to load refunds' });
  }
};

// Map existing names to route handlers if needed
exports.getPaymentSuccess = exports.paymentSuccess;
exports.getPaymentCancel = exports.paymentCancel;
// expose new handlers
exports.getReconciliation = exports.getReconciliationPage;
exports.getRefunds = exports.getRefundsPage;

// Development-only endpoint: create a minimal PayPal order and return result
exports.testCreate = async (req, res) => {
  try {
    const client = paypalClient.getClient();
    const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest)();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'GBP', value: '1.00' } }],
      application_context: {
        brand_name: 'Book Lab Store',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW'
      }
    });

    let createResp;
    try {
      createResp = await client.execute(request);
    } catch (paypalErr) {
      console.error('testCreate: PayPal API call failed', paypalErr && (paypalErr.statusCode || paypalErr.message || paypalErr));
      return res.status(502).json({ error: 'PayPal API failure', detail: paypalErr && (paypalErr.message || paypalErr.statusCode) || String(paypalErr) });
    }

    return res.status(200).json({ success: true, paypal: createResp.result });
  } catch (err) {
    console.error('testCreate fatal error', err);
    return res.status(500).json({ error: 'server_error', detail: err && (err.message || String(err)) });
  }
};
