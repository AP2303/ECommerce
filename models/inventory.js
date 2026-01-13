const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Inventory = sequelize.define('inventory', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  changeType: {
    type: Sequelize.ENUM('StockIn', 'StockOut', 'Adjustment', 'Return', 'Damaged'),
    allowNull: false
  },
  quantity: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: 'Absolute value of quantity changed'
  },
  previousStock: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  newStock: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  reason: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  referenceType: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Order, Purchase, Manual, etc.'
  },
  referenceId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'ID of the related order/purchase'
  }
});

module.exports = Inventory;

