const Sequelize = require("sequelize");

const sequelize = require("../util/database");

const Product = sequelize.define("product", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false
  },
  sku: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Stock Keeping Unit'
  },
  price: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
  stock: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  imageUrl: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  description: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  lowStockThreshold: {
    type: Sequelize.INTEGER,
    defaultValue: 10,
    comment: 'Alert when stock falls below this value',
    field: 'low_stock_threshold'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['sku']
    }
  ]
});

module.exports = Product;
