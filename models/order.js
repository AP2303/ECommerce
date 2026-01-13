const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Order = sequelize.define('order', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  orderNumber: {
    type: Sequelize.STRING,
    allowNull: true,
    unique: true,
    comment: 'Unique human-readable order number'
  },
  status: {
    type: Sequelize.ENUM('Created', 'Pending', 'Paid', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'),
    defaultValue: 'Created'
  },
  totalAmount: {
    type: Sequelize.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  currency: {
    type: Sequelize.STRING(3),
    defaultValue: 'USD'
  },
  notes: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  cancelledAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  cancelReason: {
    type: Sequelize.TEXT,
    allowNull: true
  }
});

module.exports = Order;