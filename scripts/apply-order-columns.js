require('dotenv').config();
const sequelize = require('../util/database');
const SequelizeLib = require('sequelize');
const migration = require('../migrations/20260116-ensure-order-columns-2.js');

(async () => {
  try {
    console.log('Running manual migration: 20260116-ensure-order-columns-2.js');
    const qi = sequelize.getQueryInterface();
    await migration.up(qi, SequelizeLib);
    console.log('Manual migration applied successfully');
    // Verify columns
    const desc = await qi.describeTable('orders').catch(() => null);
    console.log('orders table columns after migration:', desc ? Object.keys(desc) : 'no table');
    await sequelize.close();
  } catch (err) {
    console.error('Manual migration failed:', err);
    process.exit(1);
  }
})();

