'use strict';

const SequelizeLib = require('sequelize');

module.exports = {
  up: async (qi) => {
    // Add low_stock_threshold column if not exists
    const table = 'products';
    const column = 'low_stock_threshold';

    // Check if column exists, add if missing
    const tableDesc = await qi.describeTable(table).catch(() => null);
    if (!tableDesc || !tableDesc[column]) {
      await qi.addColumn(table, column, {
        type: SequelizeLib.INTEGER,
        allowNull: true,
        defaultValue: 10,
      });
    }

    // Ensure sku column is varchar(255) and nullable
    await qi.changeColumn(table, 'sku', {
      type: SequelizeLib.STRING(255),
      allowNull: true,
    }).catch(() => {
      // Ignore if changeColumn fails (older DB drivers)
    });

    // Create a unique index on sku if not present
    const indexName = 'products_sku_unique_idx';
    const [indexes] = await qi.sequelize.query(`SELECT indexname FROM pg_indexes WHERE tablename = '${table}';`);
    const exists = indexes.some(i => i.indexname === indexName);
    if (!exists) {
      // Avoid failing if duplicates exist: try create unique index; if it fails, create non-unique index with a warning
      try {
        await qi.addIndex(table, ['sku'], { name: indexName, unique: true });
      } catch (err) {
        console.warn(`Failed to create unique index ${indexName}:`, err.message || err);
        const fallbackName = `${indexName}_fallback`;
        try {
          await qi.addIndex(table, ['sku'], { name: fallbackName, unique: false });
          console.warn(`Created non-unique index ${fallbackName} instead.`);
        } catch (innerErr) {
          console.warn('Failed to create fallback index as well:', innerErr.message || innerErr);
        }
      }
    }
  },

  down: async (qi) => {
    const table = 'products';
    const column = 'low_stock_threshold';
    const indexName = 'products_sku_unique_idx';
    const fallbackName = `${indexName}_fallback`;

    // Remove fallback and unique indexes if they exist
    await qi.removeIndex(table, fallbackName).catch(() => {});
    await qi.removeIndex(table, indexName).catch(() => {});

    // Remove column if exists
    await qi.removeColumn(table, column).catch(() => {});
  }
};
