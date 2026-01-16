const Sequelize = require("sequelize");
require('dotenv').config();

// Validate required environment variables and coerce types
const dbName = process.env.DB_SCHEMA_NAME;
const dbUser = process.env.DB_USER_NAME;
let dbPassword = process.env.DB_USER_PASSWORD;
const dbHost = process.env.DB_HOST_URL || 'localhost';
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;

if (!dbName || !dbUser) {
  console.error('Missing required DB environment variables. Please set DB_SCHEMA_NAME and DB_USER_NAME.');
  // Do not exit here; allow Sequelize to show a helpful error if attempted.
}

// Ensure password is a string (pg requires string for SASL SCRAM)
if (typeof dbPassword !== 'string' && dbPassword != null) {
  // Coerce to string (handle numbers, objects, booleans)
  try {
    dbPassword = String(dbPassword);
    console.warn('Coerced DB_USER_PASSWORD to string.');
  } catch (err) {
    console.error('Failed to coerce DB_USER_PASSWORD to string:', err);
  }
}

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  dialect: "postgres",
  host: dbHost,
  port: dbPort,
  logging: false,
});

module.exports = sequelize;
