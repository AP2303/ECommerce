'use strict';

const SequelizeLib = require('sequelize');

module.exports = {
  up: async (qi) => {
    const table = 'orders';

    const desc = await qi.describeTable(table).catch(() => null);
    if (!desc) {
      console.warn(`Table ${table} does not exist — skipping order-columns migration`);
      return;
    }

    if (!desc.currency) {
      await qi.addColumn(table, 'currency', {
        type: SequelizeLib.STRING(3),
        allowNull: false,
        defaultValue: 'USD'
      });
    }

    if (!desc.cancelledAt) {
      await qi.addColumn(table, 'cancelledAt', {
        type: SequelizeLib.DATE,
        allowNull: true
      });
    }

    if (!desc.cancelReason) {
      await qi.addColumn(table, 'cancelReason', {
        type: SequelizeLib.TEXT,
        allowNull: true
      });
    }
  },

  down: async (qi) => {
    const table = 'orders';
    await qi.removeColumn(table, 'cancelReason').catch(() => {});
    await qi.removeColumn(table, 'cancelledAt').catch(() => {});
    await qi.removeColumn(table, 'currency').catch(() => {});
  }
};

