const Product = require('../models/product');
const Inventory = require('../models/inventory');
const Order = require('../models/order');
const OrderItem = require('../models/order-item');
const Shipment = require('../models/shipment');
const { Op } = require('sequelize');
const sequelize = require('../util/database');

/**
 * GET /warehouse/inventory
 * Get inventory list with stock levels
 */
exports.getInventory = async (req, res, next) => {
  try {
    const { lowStock, search, status, category, page = 1 } = req.query;
    const Category = require('../models/category');
    const limit = 50;
    const offset = (page - 1) * limit;

    const whereClause = { isActive: true };

    // Filter by stock status
    if (status === 'lowStock' || lowStock === 'true') {
      whereClause.stock = {
        [Op.lte]: sequelize.col('low_stock_threshold')
      };
    } else if (status === 'outOfStock') {
      whereClause.stock = 0;
    } else if (status === 'inStock') {
      whereClause.stock = {
        [Op.gt]: 0
      };
    }

    // Filter by category
    if (category && category !== 'all') {
      whereClause.categoryId = category;
    }

    // Search by title or SKU
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [{ model: Category, as: 'category', required: false }],
      attributes: ['id', 'title', 'sku', 'stock', 'low_stock_threshold', 'price'],
      order: [['stock', 'ASC']],
      limit,
      offset
    });

    // Get all categories for filter
    const categories = await Category.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.render('warehouse/inventory', {
      pageTitle: 'Inventory Management',
      path: '/warehouse/inventory',
      products,
      categories,
      currentPage: parseInt(page),
      totalPages,
      totalProducts: count
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).render('500', { error: 'Failed to fetch inventory' });
  }
};

/**
 * POST /warehouse/stock
 * Update product stock (manual adjustment)
 */
exports.postUpdateStock = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId, quantity, changeType, reason } = req.body;

    if (!productId || quantity === undefined) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Product ID and quantity are required'
      });
    }

    if (!['StockIn', 'StockOut', 'Adjustment', 'Return', 'Damaged'].includes(changeType)) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Invalid change type'
      });
    }

    const product = await Product.findByPk(productId, { transaction });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }

    const previousStock = product.stock;
    let stockChange = parseInt(quantity);

    // Calculate new stock based on change type
    let newStock;
    if (changeType === 'StockIn' || changeType === 'Return') {
      newStock = previousStock + stockChange;
    } else if (changeType === 'StockOut' || changeType === 'Damaged') {
      newStock = previousStock - stockChange;
    } else if (changeType === 'Adjustment') {
      // For adjustment, quantity is the new absolute value
      newStock = stockChange;
      stockChange = newStock - previousStock;
    }

    if (newStock < 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Stock cannot be negative',
        currentStock: previousStock,
        requestedChange: stockChange
      });
    }

    // Update product stock
    product.stock = newStock;
    await product.save({ transaction });

    // Log inventory change
    const inventoryLog = await Inventory.create({
      productId: product.id,
      changeType,
      quantity: Math.abs(stockChange),
      previousStock,
      newStock,
      reason: reason || `Manual ${changeType.toLowerCase()} by warehouse staff`,
      referenceType: 'Manual',
      referenceId: null
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Stock updated successfully',
      product: {
        id: product.id,
        title: product.title,
        sku: product.sku,
        previousStock,
        newStock,
        change: stockChange
      },
      inventoryLogId: inventoryLog.id
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

/**
 * GET /warehouse/orders-to-pack
 * Get orders ready for packing (Paid status)
 */
exports.getOrdersToPack = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { status: 'Paid' },
      include: [
        {
          model: Product,
          through: {
            model: OrderItem,
            attributes: ['quantity', 'price']
          },
          attributes: ['id', 'title', 'sku']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const ordersFormatted = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      itemCount: order.products ? order.products.length : 0,
      items: order.products ? order.products.map(p => ({
        productId: p.id,
        title: p.title,
        sku: p.sku,
        quantity: p.orderItem.quantity,
        price: p.orderItem.price
      })) : []
    }));

    res.status(200).json({
      orders: ordersFormatted,
      count: ordersFormatted.length
    });

  } catch (error) {
    console.error('Get orders to pack error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

/**
 * POST /warehouse/pack-order/:orderId
 * Mark order as packed and create shipment
 */
exports.postPackOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId } = req.params;
    const { trackingNumber, carrier, shippingMethod, estimatedDeliveryDate } = req.body;

    const order = await Order.findByPk(orderId, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'Paid') {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Only paid orders can be packed',
        currentStatus: order.status
      });
    }

    // Check if shipment already exists
    let shipment = await Shipment.findOne({
      where: { orderId },
      transaction
    });

    if (shipment) {
      // Update existing shipment
      shipment.status = 'Packed';
      shipment.packedAt = new Date();
      if (trackingNumber) shipment.trackingNumber = trackingNumber;
      if (carrier) shipment.carrier = carrier;
      if (shippingMethod) shipment.shippingMethod = shippingMethod;
      if (estimatedDeliveryDate) shipment.estimatedDeliveryDate = estimatedDeliveryDate;
      await shipment.save({ transaction });
    } else {
      // Create new shipment
      shipment = await Shipment.create({
        orderId: order.id,
        trackingNumber: trackingNumber || null,
        carrier: carrier || 'Standard',
        shippingMethod: shippingMethod || 'Standard',
        status: 'Packed',
        packedAt: new Date(),
        estimatedDeliveryDate: estimatedDeliveryDate || null
      }, { transaction });
    }

    // Update order status
    order.status = 'Packed';
    await order.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Order packed successfully',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status
      },
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        status: shipment.status,
        packedAt: shipment.packedAt
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Pack order error:', error);
    res.status(500).json({ error: 'Failed to pack order' });
  }
};

/**
 * GET /warehouse/inventory-history
 * Get inventory change history
 */
exports.getInventoryHistory = async (req, res, next) => {
  try {
    const { productId, changeType, startDate, endDate, limit = 100 } = req.query;

    const whereClause = {};

    if (productId) {
      whereClause.productId = productId;
    }

    if (changeType) {
      whereClause.changeType = changeType;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const history = await Inventory.findAll({
      where: whereClause,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'title', 'sku']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Get inventory history error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
};

/**
 * POST /warehouse/rollback-stock
 * Rollback stock for cancelled order
 */
exports.postRollbackStock = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId } = req.body;

    if (!orderId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const order = await Order.findByPk(orderId, {
      include: [{
        model: Product,
        through: { model: OrderItem, attributes: ['quantity'] }
      }],
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['Cancelled', 'Refunded'].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Only cancelled or refunded orders can have stock rolled back',
        currentStatus: order.status
      });
    }

    // Rollback stock for each item
    const rollbackResults = [];

    for (const product of order.products) {
      const quantity = product.orderItem.quantity;
      const previousStock = product.stock;
      const newStock = previousStock + quantity;

      product.stock = newStock;
      await product.save({ transaction });

      // Log inventory change
      await Inventory.create({
        productId: product.id,
        changeType: 'Return',
        quantity,
        previousStock,
        newStock,
        reason: `Stock rollback for cancelled order #${order.orderNumber || orderId}`,
        referenceType: 'Order',
        referenceId: orderId
      }, { transaction });

      rollbackResults.push({
        productId: product.id,
        title: product.title,
        quantityReturned: quantity,
        previousStock,
        newStock
      });
    }

    await transaction.commit();

    res.status(200).json({
      message: 'Stock rolled back successfully',
      orderId: order.id,
      orderNumber: order.orderNumber,
      rollbackResults
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Rollback stock error:', error);
    res.status(500).json({ error: 'Failed to rollback stock' });
  }
};

