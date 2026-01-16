'use strict';

const SequelizeLib = require('sequelize');

module.exports = {
  up: async (qi) => {
    const table = 'orders';
    // Describe table; if it exists, ensure columns are present; if not, create table with minimal columns
    const desc = await qi.describeTable(table).catch(() => null);

    if (!desc) {
      // Create table with minimal structure including desired columns
      await qi.createTable(table, {
        id: {
          type: SequelizeLib.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        createdAt: { type: SequelizeLib.DATE, allowNull: false },
        updatedAt: { type: SequelizeLib.DATE, allowNull: false },
        userId: { type: SequelizeLib.INTEGER, allowNull: false },
        orderNumber: { type: SequelizeLib.STRING, allowNull: true },
        status: { type: SequelizeLib.ENUM('Created','Pending','Paid','Processing','Packed','Shipped','Delivered','Cancelled','Refunded'), defaultValue: 'Created' },
        totalAmount: { type: SequelizeLib.DECIMAL(10,2), defaultValue: 0.00 },
        currency: { type: SequelizeLib.STRING(3), allowNull: false, defaultValue: 'USD' },
        notes: { type: SequelizeLib.TEXT, allowNull: true },
        cancelledAt: { type: SequelizeLib.DATE, allowNull: true },
        cancelReason: { type: SequelizeLib.TEXT, allowNull: true }
      });
      return;
    }

    // If table exists, add missing columns if necessary
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

