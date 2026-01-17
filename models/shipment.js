const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Shipment = sequelize.define('shipment', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  trackingNumber: {
    type: Sequelize.STRING,
    allowNull: true,
    unique: true,
    field: 'tracking_number'
  },
  carrier: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Shipping carrier name (FedEx, UPS, DHL, etc.)',
    field: 'carrier'
  },
  status: {
    type: Sequelize.ENUM('Pending', 'Processing', 'Packed', 'Shipped', 'InTransit', 'OutForDelivery', 'Delivered', 'Failed', 'Returned'),
    defaultValue: 'Pending',
    field: 'status'
  },
  shippingMethod: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Standard, Express, Overnight, etc.',
    field: 'shipping_method'
  },
  shippingCost: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'shipping_cost'
  },
  estimatedDeliveryDate: {
    type: Sequelize.DATE,
    allowNull: true,
    field: 'estimated_delivery_date'
  },
  packedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    field: 'packed_at'
  },
  shippedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    field: 'shipped_at'
  },
  deliveredAt: {
    type: Sequelize.DATE,
    allowNull: true,
    field: 'delivered_at'
  },
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    field: 'order_id',
    comment: 'Foreign key to orders.id'
  },
  shippingAddress: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Full shipping address as JSON',
    field: 'shipping_address'
  },
  notes: {
    type: Sequelize.TEXT,
    allowNull: true,
    field: 'notes'
  }
}, {
  underscored: true
});

module.exports = Shipment;
