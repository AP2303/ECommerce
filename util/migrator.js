const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('../util/database');
const SequelizeLib = require('sequelize');

const migrator = new Umzug({
  storage: new SequelizeStorage({ sequelize }),
  migrations: {
    glob: path.join(__dirname, '../migrations/*.js'),
    params: [sequelize.getQueryInterface(), SequelizeLib]
  },
  logging: console.log,
});

module.exports = migrator;
