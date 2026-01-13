require('dotenv').config();
const sequelize = require('../util/database');

console.log('Attempting Sequelize authenticate() with config from util/database.js');
sequelize.authenticate()
  .then(() => {
    console.log('Sequelize: connection OK');
    return sequelize.close();
  })
  .catch(err => {
    console.error('Sequelize connection failed:', err && err.message ? err.message : err);
    if (err && err.parent) console.error('Parent error code:', err.parent.code, 'sqlMessage:', err.parent.sqlMessage || err.parent.message);
    process.exit(1);
  });

