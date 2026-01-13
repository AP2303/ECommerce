const paypal = require('@paypal/checkout-server-sdk');
const Order = require('../models/order');
const Payment = require('../models/payment');
const Product = require('../models/product');
const OrderItem = require('../models/order-item');
const Inventory = require('../models/inventory');
const sequelize = require('../util/database');

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'YOUR_SECRET';

  if (process.env.PAYPAL_MODE === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

/**
 * POST /payment/create
 * Create PayPal payment
 */
exports.postCreatePayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Find order with items
    const order = await Order.findByPk(orderId, {
      include: [{
        model: Product,
        through: { model: OrderItem, attributes: ['quantity', 'price'] }
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order already has a payment
    const existingPayment = await Payment.findOne({ where: { orderId } });
    if (existingPayment && existingPayment.status === 'Completed') {
      return res.status(409).json({
        error: 'Order already paid',
        paymentId: existingPayment.paymentId
      });
    }

    // Verify order belongs to user
    if (order.userId !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: order.currency || 'USD',
          value: order.totalAmount.toString()
        },
        description: `Order #${order.orderNumber || orderId}`
      }],
      application_context: {
        return_url: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/success`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/cancel`,
        brand_name: 'Book Store',
        user_action: 'PAY_NOW'
      }
    });

    const paypalOrder = await client().execute(request);

    // Create payment record
    const payment = await Payment.create({
      orderId: order.id,
      paymentId: paypalOrder.result.id,
      amount: order.totalAmount,
      currency: order.currency || 'USD',
      status: 'Pending',
      paymentMethod: 'PayPal',
      metadata: {
        paypalOrderId: paypalOrder.result.id,
        paypalLinks: paypalOrder.result.links
      }
    });

    // Get approval URL
    const approvalUrl = paypalOrder.result.links.find(link => link.rel === 'approve');

    res.status(201).json({
      message: 'Payment created successfully',
      paymentId: payment.paymentId,
      approvalUrl: approvalUrl ? approvalUrl.href : null,
      orderId: order.id
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

/**
 * POST /payment/execute
 * Execute PayPal payment after user approval
 */
exports.postExecutePayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { paymentId, orderId } = req.body;

    if (!paymentId || !orderId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Payment ID and Order ID are required' });
    }

    // Find payment
    const payment = await Payment.findOne({
      where: { paymentId, orderId },
      include: [{ model: Order, as: 'order' }]
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status === 'Completed') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Payment already completed',
        transactionId: payment.transactionId
      });
    }

    // Capture PayPal payment
    const request = new paypal.orders.OrdersCaptureRequest(paymentId);
    request.requestBody({});

    const capture = await client().execute(request);

    if (capture.result.status !== 'COMPLETED') {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Payment capture failed',
        status: capture.result.status
      });
    }

    // Update payment status
    payment.status = 'Completed';
    payment.transactionId = capture.result.id;
    payment.processedAt = new Date();
    payment.metadata = {
      ...payment.metadata,
      captureResult: capture.result
    };
    await payment.save({ transaction });

    // Update order status
    const order = payment.order;
    order.status = 'Paid';
    await order.save({ transaction });

    // Deduct stock for each order item
    const orderItems = await OrderItem.findAll({
      where: { orderId: order.id },
      include: [{ model: Product }]
    });

    for (const item of orderItems) {
      const product = item.product;

      if (!product) continue;

      const previousStock = product.stock;
      const newStock = previousStock - item.quantity;

      if (newStock < 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Insufficient stock for product: ${product.title}`,
          productId: product.id,
          required: item.quantity,
          available: previousStock
        });
      }

      // Update product stock
      product.stock = newStock;
      await product.save({ transaction });

      // Log inventory change
      await Inventory.create({
        productId: product.id,
        changeType: 'StockOut',
        quantity: item.quantity,
        previousStock,
        newStock,
        reason: `Order payment - Order #${order.orderNumber || order.id}`,
        referenceType: 'Order',
        referenceId: order.id
      }, { transaction });
    }

    await transaction.commit();

    res.status(200).json({
      message: 'Payment completed successfully',
      transactionId: payment.transactionId,
      orderId: order.id,
      orderStatus: order.status
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Execute payment error:', error);
    res.status(500).json({ error: 'Failed to execute payment' });
  }
};

/**
 * GET /payment/success
 * PayPal success callback
 */
exports.getPaymentSuccess = (req, res, next) => {
  const { token, PayerID } = req.query;

  res.send(`
    <html>
      <head><title>Payment Successful</title></head>
      <body>
        <h1>Payment Successful!</h1>
        <p>Thank you for your payment.</p>
        <p>Payment Token: ${token}</p>
        <p>Payer ID: ${PayerID}</p>
        <p><a href="/">Return to Home</a> | <a href="/orders">View Orders</a></p>
      </body>
    </html>
  `);
};

/**
 * GET /payment/cancel
 * PayPal cancel callback
 */
exports.getPaymentCancel = (req, res, next) => {
  res.send(`
    <html>
      <head><title>Payment Cancelled</title></head>
      <body>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled.</p>
        <p><a href="/cart">Return to Cart</a> | <a href="/">Go Home</a></p>
      </body>
    </html>
  `);
};

/**
 * POST /payment/webhook
 * PayPal webhook handler for payment events
 */
exports.postPayPalWebhook = async (req, res, next) => {
  try {
    const webhookEvent = req.body;

    console.log('PayPal Webhook Event:', webhookEvent.event_type);

    // Handle different webhook events
    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment captured successfully
        console.log('Payment captured:', webhookEvent.resource.id);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        // Payment denied
        console.log('Payment denied:', webhookEvent.resource.id);
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        // Payment refunded
        console.log('Payment refunded:', webhookEvent.resource.id);
        break;

      default:
        console.log('Unhandled webhook event:', webhookEvent.event_type);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * GET /payment/order/:orderId
 * Get payment details for an order
 */
exports.getPaymentByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({
      where: { orderId },
      include: [{
        model: Order,
        as: 'order',
        attributes: ['id', 'orderNumber', 'status', 'totalAmount']
      }]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for this order' });
    }

    // Verify order belongs to user (unless admin)
    if (payment.order.userId !== req.session.userId && req.session.userRole !== 'Administrator') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.status(200).json({
      payment: {
        id: payment.id,
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        processedAt: payment.processedAt,
        order: payment.order
      }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
};

