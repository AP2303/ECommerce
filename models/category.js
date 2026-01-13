const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Category = sequelize.define('category', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  slug: {
    type: Sequelize.STRING,
    allowNull: true,
    unique: true
  }
});

module.exports = Category;

