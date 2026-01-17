const Product = require('../models/product');
const Inventory = require('../models/inventory');
const Order = require('../models/order');

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
    res.status(500).render('500', { error: 'Failed to load inventory' });
  }
};

exports.postUpdateStock = async (req, res) => {
  try {
    const { productId, quantity, changeType, reason } = req.body;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Apply update
    const q = parseInt(quantity, 10) || 0;
    if (changeType === 'add') {
      product.stock = product.stock + q;
    } else if (changeType === 'remove') {
      product.stock = Math.max(0, product.stock - q);
    }
    await product.save();

    // Log inventory change
    await Inventory.create({ productId: product.id, change: q, reason: reason || 'Manual update', userId: req.user ? req.user.id : null });

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
      include: [{ model: require('../models/user'), attributes: ['id','name','email'] }]
    });

    res.render('warehouse/orders-to-pack', { pageTitle: 'Orders to Pack', path: '/warehouse/orders-to-pack', orders });
  } catch (err) {
    console.error('getOrdersToPack error:', err);
    res.status(500).render('500', { error: 'Failed to load orders to pack' });
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
    console.error('getInventoryHistory error:', err);
    res.status(500).render('500', { error: 'Failed to load inventory history' });
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
