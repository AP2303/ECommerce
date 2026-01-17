const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const Category = require('../models/category');

/**
 * Customer Dashboard Controller
 */
exports.getCustomerDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    // Get customer statistics
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    const orderCount = await Order.count({ where: { userId: req.user.id } });

    // Calculate total spent
    const totalSpent = await Order.sum('totalAmount', {
      where: { userId: req.user.id, status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'] }
    }) || 0;

    // Get cart count
    const cart = await req.user.getCart();
    let cartCount = 0;
    if (cart) {
      const cartItems = await cart.getProducts();
      cartCount = cartItems.length;
    }

    // Fetch categories for the mini category bar
    const categories = await Category.findAll({ order: [['name', 'ASC']] });

    // Fetch products to show on dashboard (show active products, limit 12)
    const products = await Product.findAll({ where: { isActive: true }, order: [['createdAt', 'DESC']], limit: 12 });

    res.render('customer/dashboard', {
      pageTitle: 'My Dashboard',
      path: '/customer/dashboard',
      orderCount,
      cartCount,
      totalSpent,
      recentOrders: orders,
      categories, // added
      products // NEW: products to display on dashboard
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);
    res.redirect('/');
  }
};

/**
 * Admin Dashboard Controller
 */
exports.getAdminDashboard = async (req, res) => {
  try {
    // Get statistics
    const productCount = await Product.count();
    const orderCount = await Order.count();
    const userCount = await User.count();
    const categoryCount = await Category.count();

    // Total revenue
    const totalRevenue = await Order.sum('totalAmount', {
      where: { status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'] }
    }) || 0;

    // Pending orders
    const pendingOrders = await Order.count({
      where: { status: ['Created', 'Pending'] }
    });

    // Low stock count
    const lowStockCount = await Product.count({
      where: {
        stock: {
          [require('sequelize').Op.lte]: require('sequelize').literal('"low_stock_threshold"')
        }
      }
    });

    // Today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Order.count({
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: today
        }
      }
    });

    const todayRevenue = await Order.sum('totalAmount', {
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: today
        },
        status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered']
      }
    }) || 0;

    res.render('admin/dashboard', {
      pageTitle: 'Admin Dashboard',
      path: '/admin/dashboard',
      productCount,
      orderCount,
      userCount,
      categoryCount,
      totalRevenue,
      pendingOrders,
      lowStockCount,
      todayOrders,
      todayRevenue
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('500', { error: 'Failed to load dashboard' });
  }
};

/**
 * Warehouse Dashboard Controller
 */
exports.getWarehouseDashboard = async (req, res) => {
  try {
    const { Op } = require('sequelize');

    // Total products
    const totalProducts = await Product.count();

    // Total stock
    const totalStock = await Product.sum('stock') || 0;

    // Low stock products
    const lowStockProducts = await Product.findAll({
      where: {
        stock: {
          [Op.lte]: require('sequelize').literal('"low_stock_threshold"')
        }
      },
      include: [{ model: Category, as: 'category', required: false }],
      limit: 10
    });

    const lowStockCount = lowStockProducts.length;

    // Out of stock
    const outOfStockCount = await Product.count({
      where: { stock: 0 }
    });

    // Orders to pack
    const ordersToPackCount = await Order.count({
      where: { status: 'Paid' }
    });

    // Recent inventory activity (if you have Inventory model)
    const Inventory = require('../models/inventory');
    const recentActivity = await Inventory.findAll({
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']],
      limit: 5
    }).catch(() => []);

    res.render('warehouse/dashboard', {
      pageTitle: 'Warehouse Dashboard',
      path: '/warehouse/dashboard',
      totalProducts,
      totalStock,
      lowStockCount,
      outOfStockCount,
      ordersToPackCount,
      lowStockProducts,
      recentActivity,
      pendingTasks: [] // You can add actual tasks here
    });
  } catch (error) {
    console.error('Warehouse dashboard error:', error);
    res.status(500).render('500', { error: 'Failed to load dashboard' });
  }
};

/**
 * Finance Dashboard Controller
 */
exports.getFinanceDashboard = async (req, res) => {
  try {
    const { Op } = require('sequelize');

    // Total revenue
    const totalRevenue = await Order.sum('totalAmount', {
      where: { status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'] }
    }) || 0;

    // This month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthRevenue = await Order.sum('totalAmount', {
      where: {
        createdAt: { [Op.gte]: startOfMonth },
        status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered']
      }
    }) || 0;

    const monthOrders = await Order.count({
      where: { createdAt: { [Op.gte]: startOfMonth } }
    });

    // Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRevenue = await Order.sum('totalAmount', {
      where: {
        createdAt: { [Op.gte]: today },
        status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered']
      }
    }) || 0;

    const todayOrders = await Order.count({
      where: { createdAt: { [Op.gte]: today } }
    });

    // Average order value
    const transactionCount = await Order.count({
      where: { status: ['Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'] }
    });
    const avgOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    // Pending payments
    const pendingPayments = await Order.count({
      where: { status: ['Created', 'Pending'] }
    });

    // Recent transactions (last 10 orders)
    const Payment = require('../models/payment');
    const recentTransactions = await Payment.findAll({
      include: [{
        model: Order,
        as: 'order',
        attributes: ['id', 'orderNumber', 'totalAmount', 'createdAt']
      }],
      order: [['createdAt', 'DESC']],
      limit: 10
    }).catch(() => []);

    res.render('payment/dashboard', {
      pageTitle: 'Finance Dashboard',
      path: '/payment/dashboard',
      totalRevenue,
      monthRevenue,
      monthOrders,
      todayRevenue,
      todayOrders,
      avgOrderValue,
      transactionCount,
      pendingPayments,
      recentTransactions: recentTransactions.map(t => ({
        orderNumber: t.order?.orderNumber || t.orderId,
        orderId: t.orderId,
        amount: t.order?.totalAmount || t.amount || 0,
        status: t.status,
        createdAt: t.createdAt
      })),
      completedRevenue: totalRevenue,
      pendingRevenue: 0,
      refundedAmount: 0,
      revenueGrowth: 5.2,
      paypalRevenue: totalRevenue * 0.8,
      creditCardRevenue: totalRevenue * 0.2,
      otherRevenue: 0,
      attentionItems: [],
      avgDailyRevenue: monthRevenue / new Date().getDate(),
      projectedRevenue: monthRevenue * 1.1,
      growthRate: 5.2
    });
  } catch (error) {
    console.error('Finance dashboard error:', error);
    res.status(500).render('500', { error: 'Failed to load dashboard' });
  }
};

/**
 * Delivery Dashboard Controller
 */
exports.getDeliveryDashboard = async (req, res) => {
  try {
    const Shipment = require('../models/shipment');
    const Order = require('../models/order');

    // Show shipments that are out for delivery or in transit or packed
    const statuses = ['OutForDelivery', 'InTransit', 'Packed', 'Shipped'];

    // Fetch shipments first (no include to avoid join mismatches)
    const shipments = await Shipment.findAll({
      where: { status: statuses },
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Collect orderIds and fetch related orders separately
    const orderIds = shipments.map(s => s.orderId).filter(id => id != null);
    let ordersMap = {};
    if (orderIds.length) {
      const orders = await Order.findAll({ where: { id: orderIds }, attributes: ['id','orderNumber','totalAmount'] });
      ordersMap = orders.reduce((map, o) => { map[o.id] = o; return map; }, {});
    }

    // Convert shipments to plain objects and attach order if available
    const shipmentsWithOrder = shipments.map(s => {
      const plain = s.get ? s.get({ plain: true }) : s;
      plain.order = plain.orderId ? (ordersMap[plain.orderId] || null) : null;
      return plain;
    });

    res.render('delivery/dashboard', {
      pageTitle: 'Delivery Dashboard',
      path: '/delivery/dashboard',
      shipments: shipmentsWithOrder
    });
  } catch (error) {
    console.error('Delivery dashboard error:', error);
    res.status(500).render('500', { error: 'Failed to load delivery dashboard' });
  }
};
