const Sequelize = require("sequelize");
const sequelize = require("../util/database");

const User = sequelize.define("user", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Hashed password using bcrypt'
  },
  emailVerified: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  verificationToken: {
    type: Sequelize.STRING,
    allowNull: true
  },
  loginAttempts: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  isLocked: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  lockedUntil: {
    type: Sequelize.DATE,
    allowNull: true
  },
  resetPasswordToken: {
    type: Sequelize.STRING,
    allowNull: true
  },
  resetPasswordExpires: {
    type: Sequelize.DATE,
    allowNull: true
  },
  lastLoginAt: {
    type: Sequelize.DATE,
    allowNull: true
  }
});

module.exports = User;
