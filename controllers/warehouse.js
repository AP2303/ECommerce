const Product = require('../models/product');
const Inventory = require('../models/inventory');
const Order = require('../models/order');
const User = require('../models/user');

exports.getInventory = async (req, res) => {
  try {
    const products = await Product.findAll({ order: [['title', 'ASC']] });
    res.render('warehouse/inventory', {
      pageTitle: 'Inventory',
      path: '/warehouse/inventory',
      products
    });
  } catch (err) {
    console.error('getInventory error:', err);
    res.status(500).render('500', { pageTitle: 'Inventory - Error', path: req.path, error: 'Failed to load inventory' });
  }
};

exports.postUpdateStock = async (req, res) => {
  try {
    const { productId, quantity, changeType, reason } = req.body;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Apply update
    const q = parseInt(quantity, 10) || 0;
    const prev = product.stock || 0;
    let newStock = prev;
    let inventoryChangeType = 'Adjustment';
    if (changeType === 'add') {
      newStock = prev + q;
      product.stock = newStock;
      inventoryChangeType = 'StockIn';
    } else if (changeType === 'remove') {
      newStock = Math.max(0, prev - q);
      product.stock = newStock;
      inventoryChangeType = 'StockOut';
    }
    await product.save();

    // Log inventory change using defined Inventory fields
    await Inventory.create({
      productId: product.id,
      changeType: inventoryChangeType,
      quantity: q,
      previousStock: prev,
      newStock: newStock,
      reason: reason || 'Manual update',
      referenceType: 'Manual',
      referenceId: null
    });

    console.log('postUpdateStock: updated product', product.id, 'prev=', prev, 'new=', newStock, 'changeType=', inventoryChangeType);

    res.status(200).json({ message: 'Stock updated', stock: product.stock });
  } catch (err) {
    console.error('postUpdateStock error:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

exports.getOrdersToPack = async (req, res) => {
  try {
    // Orders with status 'Paid' are considered ready to pack
    const orders = await Order.findAll({
      where: { status: 'Paid' },
      order: [['createdAt', 'DESC']],
      limit: 50,
      attributes: ['id', 'orderNumber', 'status', 'totalAmount', 'createdAt', 'userId'],
      include: [{ model: User, as: 'user', attributes: ['id','name','email'] }]
    });

    res.render('warehouse/orders-to-pack', { pageTitle: 'Orders to Pack', path: '/warehouse/orders-to-pack', orders });
  } catch (err) {
    console.error('getOrdersToPack error:', err);
    res.status(500).render('500', { pageTitle: 'Orders to Pack - Error', path: req.path, error: (err && err.stack) || String(err) });
  }
};

exports.postPackOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    // TODO: mark order items as packed and update order status
    res.status(200).json({ message: 'Order marked as packed (stub)', orderId });
  } catch (err) {
    console.error('postPackOrder error:', err);
    res.status(500).json({ error: 'Failed to mark order as packed' });
  }
};

exports.getInventoryHistory = async (req, res) => {
  try {
    // include associated product for context
    const history = await Inventory.findAll({ include: [{ model: Product, as: 'product' }], limit: 100, order: [['createdAt', 'DESC']] });
    res.render('warehouse/inventory-history', { pageTitle: 'Inventory History', path: '/warehouse/inventory-history', history });
  } catch (err) {
    console.error('getInventoryHistory error (findAll):', err);
    // Fallback: try raw query against common table names to be tolerant of schema mismatches
    try {
      const sequelize = require('../util/database');
      const tryTables = ['inventories', 'inventory'];
      let rows = [];
      for (const t of tryTables) {
        try {
          const sql = `SELECT * FROM "${t}" ORDER BY "createdAt" DESC LIMIT 100`;
          console.log('getInventoryHistory: attempting raw query on table', t);
          const [result] = await sequelize.query(sql);
          if (result && result.length) { rows = result; break; }
        } catch (qe) {
          // continue trying other table names
          console.warn('getInventoryHistory raw query failed for table', t, qe.message);
        }
      }

      // If we have rows, attempt to attach product titles (best-effort)
      if (rows && rows.length) {
        const out = [];
        for (const r of rows) {
          const entry = Object.assign({}, r);
          try {
            if (r.productId) {
              const prod = await Product.findByPk(r.productId);
              entry.product = prod ? { title: prod.title } : null;
            }
          } catch (inner) {
            console.warn('getInventoryHistory: failed to load product for row', r.productId, inner && inner.message);
          }
          out.push(entry);
        }
        return res.render('warehouse/inventory-history', { pageTitle: 'Inventory History', path: '/warehouse/inventory-history', history: out });
      }

      // No rows found via fallback - render empty history with a helpful note
      return res.render('warehouse/inventory-history', { pageTitle: 'Inventory History', path: '/warehouse/inventory-history', history: [] });
    } catch (fallbackErr) {
      console.error('getInventoryHistory fallback error:', fallbackErr);
      // As a last resort, render the view with empty history instead of throwing 500
      return res.render('warehouse/inventory-history', { pageTitle: 'Inventory History', path: '/warehouse/inventory-history', history: [] });
    }
  }
};

exports.postRollbackStock = async (req, res) => {
  try {
    const { orderId } = req.body;
    // TODO: implement rollback logic based on order items
    res.status(200).json({ message: 'Rollback processed (stub)', orderId });
  } catch (err) {
    console.error('postRollbackStock error:', err);
    res.status(500).json({ error: 'Failed to rollback stock' });
  }
};
