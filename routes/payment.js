const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment");

/**
 * Payment Routes
 */

// POST /payment/create-paypal-order - Create PayPal order (for JavaScript SDK v5)
router.post("/create-paypal-order", paymentController.createPayPalOrder);

// POST /payment/create - Create PayPal payment (Authenticated users)
router.post("/create", paymentController.postCreatePayment);

// POST /payment/execute - Execute PayPal payment (Authenticated users)
router.post("/execute", paymentController.postExecutePayment);

// GET /payment/success - PayPal success callback
router.get("/success", paymentController.getPaymentSuccess);

// GET /payment/cancel - PayPal cancel callback
router.get("/cancel", paymentController.getPaymentCancel);

// POST /payment/webhook - PayPal webhook handler (no auth required for webhooks)
router.post("/webhook", paymentController.postPayPalWebhook);

// GET /payment/order/:orderId - Get payment by order ID (Authenticated users)
router.get("/order/:orderId", paymentController.getPaymentByOrder);

// GET /payment/transactions - Transaction list page
router.get("/transactions", paymentController.getTransactionsPage);

// GET /payment/reports - Reports page
router.get("/reports", paymentController.getReportsPage);

// NEW: reconciliation and refunds pages
router.get('/reconciliation', paymentController.getReconciliationPage);
router.get('/refunds', paymentController.getRefundsPage);

// Development-only test endpoint to verify PayPal API connectivity
router.get('/test', paymentController.testCreate);

module.exports = router;
