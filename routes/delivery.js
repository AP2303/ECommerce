const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/delivery');

// Dashboard redirect handled by app.js route; additional delivery routes:
router.get('/dashboard', (req, res) => {
  res.redirect('/delivery/dashboard');
});

// View a specific shipment
router.get('/shipments/:id', deliveryController.getShipmentDetail);

// Mark shipment as delivered
router.post('/shipments/:id/deliver', deliveryController.postMarkDelivered);

module.exports = router;
