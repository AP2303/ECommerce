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
    allowNull: false, // DB expects a payment id for persisted records
    unique: false,
    comment: 'External payment provider ID (e.g., PayPal payment ID)'
    // removed `field: 'payment_id'` so the model uses camelCase column `paymentId`
  },
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'Local order id this payment relates to'
    // removed `field: 'order_id'`
  },
  transactionId: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Transaction ID after successful payment'
    // removed `field: 'transaction_id'`
  },
  amount: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: Sequelize.STRING(3),
    defaultValue: 'GBP'
  },
  status: {
    type: Sequelize.ENUM('Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded'),
    defaultValue: 'Pending'
  },
  paymentMethod: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: 'PayPal',
    comment: 'PayPal, CreditCard, etc.'
    // removed `field: 'payment_method'`
  },
  processedAt: {
    type: Sequelize.DATE,
    allowNull: true
    // removed `field: 'processed_at'`
  },
  payerEmail: {
    type: Sequelize.STRING,
    allowNull: true
    // removed `field: 'payer_email'`
  },
  payerName: {
    type: Sequelize.STRING,
    allowNull: true
    // removed `field: 'payer_name'`
  },
  metadata: {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Additional payment data from provider'
  }
}, {
  // Use default camelCase timestamps (createdAt / updatedAt) to match your DB
  timestamps: true,
  underscored: false,
  tableName: 'payments'
});

module.exports = Payment;
