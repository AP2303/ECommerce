const { Client } = require('pg');
require('dotenv').config();

const cfg = {
  user: process.env.DB_USER_NAME,
  host: process.env.DB_HOST_URL || 'localhost',
  database: process.env.DB_SCHEMA_NAME,
  password: process.env.DB_USER_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  connectionTimeoutMillis: 5000,
};

console.log('Testing Postgres connection with config:', { user: cfg.user, host: cfg.host, database: cfg.database, port: cfg.port });

const client = new Client(cfg);
client.connect()
  .then(() => client.query('SELECT version()'))
  .then(res => {
    console.log('Connected to Postgres. Server version:', res.rows[0].version);
    return client.end();
  })
  .catch(err => {
    console.error('Connection failed. Error message:', err.message);
    if (err.code) console.error('Error code:', err.code);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    process.exit(1);
  });

