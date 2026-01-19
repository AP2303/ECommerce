const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Cart = sequelize.define('cart', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  guestToken: {
    type: Sequelize.STRING,
    allowNull: true,
    unique: true,
    comment: 'Optional token to associate a cart with a guest via cookie'
  }
})

module.exports = Cart;