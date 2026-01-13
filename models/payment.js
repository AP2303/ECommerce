const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Payment = sequelize.define('payment', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  paymentId: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    comment: 'External payment provider ID (e.g., PayPal payment ID)'
  },
  transactionId: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Transaction ID after successful payment'
  },
  amount: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: Sequelize.STRING(3),
    defaultValue: 'USD'
  },
  status: {
    type: Sequelize.ENUM('Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded'),
    defaultValue: 'Pending'
  },
  paymentMethod: {
    type: Sequelize.STRING,
    allowNull: false,
    comment: 'PayPal, CreditCard, etc.'
  },
  processedAt: {
    type: Sequelize.DATE,
    allowNull: true
  },
  payerEmail: {
    type: Sequelize.STRING,
    allowNull: true
  },
  payerName: {
    type: Sequelize.STRING,
    allowNull: true
  },
  metadata: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Additional payment data from provider'
  }
});

module.exports = Payment;

