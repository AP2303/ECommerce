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
  shippingAddress: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Full shipping address as JSON'
  },
  notes: {
    type: Sequelize.TEXT,
    allowNull: true
  }
});

module.exports = Shipment;

