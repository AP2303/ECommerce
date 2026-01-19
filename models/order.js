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
      defaultValue: 'GBP'
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
}, {
  hooks: {
    beforeValidate: (order, options) => {
      if (!order.orderNumber) {
        const timestamp = Date.now();
        const rand = Math.floor(Math.random() * 90000) + 10000;
        order.orderNumber = `ORD-${timestamp}-${rand}`;
      }
    },
    beforeCreate: (order, options) => {
      // Ensure a unique, human-friendly order number exists
      if (!order.orderNumber) {
        const timestamp = Date.now();
        const rand = Math.floor(Math.random() * 90000) + 10000; // 5 digit random
        order.orderNumber = `ORD-${timestamp}-${rand}`;
      }
    }
  }
});

module.exports = Order;