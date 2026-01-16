const Sequelize = require("sequelize");
const sequelize = require("../util/database");
const bcrypt = require('bcrypt');

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
  },
  roleId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    comment: 'Foreign key to roles table'
  }
});

// Helper to decide if a password string looks like a bcrypt hash
function looksLikeBcryptHash(pw) {
  return typeof pw === 'string' && pw.startsWith('$2') && pw.length >= 60;
}

// Sequelize hooks to hash password before create/update
User.beforeCreate(async (user, options) => {
  if (user.password && !looksLikeBcryptHash(user.password)) {
    const hashed = await bcrypt.hash(user.password, 12);
    user.password = hashed;
  }
});

User.beforeUpdate(async (user, options) => {
  // Only hash if password was changed and doesn't already look hashed
  if (user.changed('password') && user.password && !looksLikeBcryptHash(user.password)) {
    const hashed = await bcrypt.hash(user.password, 12);
    user.password = hashed;
  }
});

module.exports = User;
