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
    unique: true
  },
  carrier: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Shipping carrier name (FedEx, UPS, DHL, etc.)'
  },
  status: {
    type: Sequelize.ENUM('Pending', 'Processing', 'Packed', 'Shipped', 'InTransit', 'OutForDelivery', 'Delivered', 'Failed', 'Returned'),
    defaultValue: 'Pending'
  },
  shippingMethod: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Standard, Express, Overnight, etc.'
  },
  shippingCost: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  estimatedDeliveryDate: {
    type: Sequelize.DATE,
    allowNull: true
  },
  packedAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  shippedAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  // Explicit orderId so Sequelize uses this DB column name (mixed-case DB)
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    field: 'orderId',
    comment: 'Foreign key to orders.id (DB column is orderId)'
  },
  shippingAddress: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Full shipping address as JSON'
  },
  notes: {
    type: Sequelize.TEXT,
    allowNull: true
  }
}, {
  // DB uses mixed-case column names (orderId etc). Do not auto-convert to snake_case.
  underscored: false
});

module.exports = Shipment;
