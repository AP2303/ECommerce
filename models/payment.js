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
    comment: 'External payment provider ID (e.g., PayPal payment ID)',
    field: 'payment_id'
  },
  transactionId: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Transaction ID after successful payment',
    field: 'transaction_id'
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
    comment: 'PayPal, CreditCard, etc.',
    field: 'payment_method'
  },
  processedAt: {
    type: Sequelize.DATE,
    allowNull: true,
    field: 'processed_at'
  },
  payerEmail: {
    type: Sequelize.STRING,
    allowNull: true,
    field: 'payer_email'
  },
  payerName: {
    type: Sequelize.STRING,
    allowNull: true,
    field: 'payer_name'
  },
  metadata: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Additional payment data from provider'
  }
}, {
  underscored: true
});

module.exports = Payment;
