const Payment = require('../models/payment');
const Order = require('../models/order');

// Start payment (placeholder) - returns a JSON payload for frontend to redirect to gateway
exports.startPayment = async (req, res) => {
  try {
    // TODO: integrate with PayPal or other gateway
    // For now return a stubbed response
    res.status(200).json({ message: 'Payment start endpoint (stub)', redirectUrl: '/payment/success' });
  } catch (err) {
    console.error('startPayment error:', err);
    res.status(500).json({ error: 'Failed to start payment' });
  }
};

exports.paymentSuccess = async (req, res) => {
  try {
    // TODO: handle gateway callback, verify transaction, update order status
    res.render('payment/success', { pageTitle: 'Payment Success', path: '/payment/success' });
  } catch (err) {
    console.error('paymentSuccess error:', err);
    res.status(500).render('500', { error: 'Payment success handler failed' });
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

// Create payment (stub)
exports.postCreatePayment = async (req, res) => {
  // For now call startPayment
  return exports.startPayment(req, res);
};

// Execute payment (stub)
exports.postExecutePayment = async (req, res) => {
  // TODO: integrate execution logic
  res.status(200).json({ message: 'Payment executed (stub)', redirectUrl: '/payment/success' });
};

// PayPal webhook handler (stub)
exports.postPayPalWebhook = async (req, res) => {
  console.log('Received PayPal webhook (stub)');
  res.status(200).send('OK');
};

// Get payment by order id (stub)
exports.getPaymentByOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    // TODO: fetch from Payment model
    res.status(200).json({ message: 'Payment details (stub)', orderId });
  } catch (err) {
    console.error('getPaymentByOrder error:', err);
    res.status(500).json({ error: 'Failed to retrieve payment' });
  }
};

exports.getTransactionsPage = async (req, res) => {
  try {
    // Try to fetch payments if model exists, otherwise render empty
    let transactions = [];
    if (Payment && typeof Payment.findAll === 'function') {
      transactions = await Payment.findAll({ order: [['createdAt','DESC']], limit: 100 });
    }
    res.render('payment/transactions', { pageTitle: 'Transactions', path: '/payment/transactions', transactions });
  } catch (err) {
    console.error('getTransactionsPage error:', err);
    res.status(500).render('500', { error: 'Failed to load transactions' });
  }
};

exports.getReportsPage = async (req, res) => {
  try {
    // Build some summary data from orders/payments
    const totalRevenue = await Order.sum('totalAmount') || 0;
    const transactionCount = await Order.count();
    res.render('payment/reports', { pageTitle: 'Payment Reports', path: '/payment/reports', totalRevenue, transactionCount });
  } catch (err) {
    console.error('getReportsPage error:', err);
    res.status(500).render('500', { error: 'Failed to load reports' });
  }
};

// Map existing names to route handlers if needed
exports.getPaymentSuccess = exports.paymentSuccess;
exports.getPaymentCancel = exports.paymentCancel;
