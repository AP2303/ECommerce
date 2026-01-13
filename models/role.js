const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Role = sequelize.define('role', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isIn: [['Customer', 'Administrator', 'Warehouse', 'Finance', 'Delivery']]
    }
  },
  description: {
    type: Sequelize.STRING,
    allowNull: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Role;

