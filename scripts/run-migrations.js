require('dotenv').config();
const migrator = require('../util/migrator');

async function run() {
  try {
    console.log('Running pending migrations...');
    await migrator.up();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();

