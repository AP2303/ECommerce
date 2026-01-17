const Product = require("../models/product");
const Order = require('../models/order');
const User = require('../models/user');
const OrderItem = require('../models/order-item');

function renderLogin(req, res) {
  return res.render('user/index', { errorMessage: 'Please login to access admin pages' });
}

exports.getAddProduct = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
  });
};

exports.getEditProduct = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  const productId = req.params.productId;
  // Admins should be able to edit any product; use Product.findByPk
  Product.findByPk(productId)
    .then(product => {
      if (!product) {
        return res.redirect('/admin/product-list');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: true,
        product: product
      });
    })
    .catch(error => {
      console.error('Error in Admin Controller, getEditProduct:', error);
      res.redirect('/admin/product-list');
    });
};

exports.postAddProduct = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  const title = req.body.title;
  const imageUrl = req.body.imageUrl;
  const description = req.body.description;
  const price = req.body.price;
  req.user
    .createProduct({
      title: title,
      price: price,
      imageUrl: imageUrl,
      description: description,
    })
    .then((result) => {
      console.log("Product Created");
      res.redirect("/admin/product-list");
    })
    .catch((error) => {
      console.log("Error in Admin Controller, postAddProduct: {}", error);
    });
};

exports.postEditProduct = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  const id = req.body.productId;

  Product.findByPk(id)
    .then((product) => {
      product.title = req.body.title;
      product.imageUrl = req.body.imageUrl;
      product.description = req.body.description;
      product.price = req.body.price;
      return product.save();
    })
    .then((result) => {
      console.log("Product updated successfully");
      res.redirect("/admin/product-list");
    })
    .catch((error) =>
      console.log("Error in Admin Controller, postEditProduct: {}", error)
    );
};

exports.getProducts = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  // Admin should see all products
  Product.findAll()
    .then((products) => {
      try {
        res.render("admin/product-list", {
          pageTitle: "Admin Products",
          path: "/admin/product-list",
          prods: products,
          hasProducts: products.length > 0,
        });
      } catch (renderErr) {
        console.error('Admin getProducts render error:', renderErr);
        // fallback to simple rendering with basic fields
        const safeProds = (products || []).map(p => ({ id: p.id, title: p.title || '', price: p.price || 0, description: p.description || '', imageUrl: p.imageUrl || '' }));
        return res.render('admin/product-list', { pageTitle: 'Admin Products', path: '/admin/product-list', prods: safeProds, hasProducts: safeProds.length>0 });
      }
    })
    .catch(async (error) => {
      console.error('Product.findAll failed, attempting raw SQL fallback:', error && error.message);
      try {
        const sequelize = require('../util/database');
        const [cols] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        const colNames = cols.map(c => c.column_name);
        const pick = (cands) => cands.find(c => colNames.includes(c));
        const idCol = pick(['id']);
        const titleCol = pick(['title']);
        const priceCol = pick(['price']);
        const descCol = pick(['description']);
        const imageCol = pick(['imageUrl','image_url','imageurl']);

        const selectCols = [];
        if (idCol) selectCols.push(`${idCol} as "id"`);
        if (titleCol) selectCols.push(`${titleCol} as "title"`);
        if (priceCol) selectCols.push(`${priceCol} as "price"`);
        if (descCol) selectCols.push(`${descCol} as "description"`);
        if (imageCol) selectCols.push(`${imageCol} as "imageUrl"`);

        const sql = `SELECT ${selectCols.join(', ')} FROM "products" ORDER BY ${titleCol || idCol || 'id'} LIMIT 500`;
        const [rows] = await sequelize.query(sql);
        return res.render('admin/product-list', { pageTitle: 'Admin Products', path: '/admin/product-list', prods: rows || [], hasProducts: (rows && rows.length>0) });
      } catch (rawErr) {
        console.error('Admin getProducts fallback failed:', rawErr);
        // final fallback: render empty list
        return res.render('admin/product-list', { pageTitle: 'Admin Products', path: '/admin/product-list', prods: [], hasProducts: false });
      }
    });
};

// orders listing
exports.getOrders = async (req, res) => {
  if (!req.user) return renderLogin(req, res);
  try {
    const status = req.query.status;
    const where = {};
    if (status) where.status = status.charAt(0).toUpperCase() + status.slice(1);
    try {
      const orders = await Order.findAll({
        where,
        order: [['createdAt','DESC']],
        include: [
          { model: User, attributes: ['id','name','email'] },
          { model: OrderItem, as: 'orderItems', include: [{ model: Product, as: 'product' }] }
        ]
      });
      try {
        return res.render('admin/orders', { pageTitle: 'Orders', path: '/admin/orders', orders });
      } catch (renderErr) {
        console.error('Admin getOrders render error (model result):', renderErr);
        // fallback to minimal HTML
        return res.send('<h1>Orders (render failed) - check server logs</h1>');
      }
    } catch (modelErr) {
      console.error('Admin getOrders model query failed, falling back to simple query:', modelErr && modelErr.message);
      const sequelize = require('../util/database');
      // detect columns on orders table
      const [cols] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'");
      const colNames = cols.map(c => c.column_name);
      const pick = (cands) => cands.find(c => colNames.includes(c));
      const idCol = pick(['id']);
      const orderNumberCol = pick(['orderNumber','order_number','ordernumber']);
      const statusCol = pick(['status']);
      const totalAmountCol = pick(['totalAmount','total_amount','totalamount']);
      const createdAtCol = pick(['createdAt','created_at','createdat']);
      const userIdCol = pick(['userId','user_id','userid']);

      const selectCols = [];
      if (idCol) selectCols.push(`${idCol} as "id"`);
      if (orderNumberCol) selectCols.push(`${orderNumberCol} as "orderNumber"`);
      if (statusCol) selectCols.push(`${statusCol} as "status"`);
      if (totalAmountCol) selectCols.push(`${totalAmountCol} as "totalAmount"`);
      if (createdAtCol) selectCols.push(`${createdAtCol} as "createdAt"`);
      if (userIdCol) selectCols.push(`${userIdCol} as "userId"`);

      const orderByCol = createdAtCol || idCol || 'id';
      const sql = `SELECT ${selectCols.join(', ')} FROM "orders"` + (status ? ` WHERE ${statusCol || 'status'} = '${where.status}'` : '') + ` ORDER BY "${orderByCol}" DESC LIMIT 200`;
      let rows = [];
      try {
        const [result] = await sequelize.query(sql);
        rows = result;
      } catch (rawErr) {
        console.error('Admin getOrders fallback raw query failed:', rawErr);
        rows = [];
      }
      // Render without order items (best-effort)
      try {
        return res.render('admin/orders', { pageTitle: 'Orders', path: '/admin/orders', orders: rows });
      } catch (renderErr2) {
        console.error('Admin getOrders render error (fallback rows):', renderErr2);
        return res.send('<h1>Orders (render failed) - check server logs</h1>');
      }
    }
  } catch (err) {
    console.error('Admin getOrders error:', err);
    res.status(500).render('500', { error: 'Failed to load orders' });
  }
};

exports.deleteProduct = (req, res, next) => {
  if (!req.user) return renderLogin(req, res);
  const productId = req.body.productId;
  Product.findByPk(productId)
    .then((product) => {
      if (product) return product.destroy();
      return Promise.resolve();
    })
    .then((result) => {
      console.log("destroyed successfully", result);
      const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
      if (isAjax) {
        return res.json({ success: true, productId });
      }
      res.redirect("/admin/product-list");
    })
    .catch((error) => {
      console.log("Error in Admin Controller, deleteProduct: {}", error);
      const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
      if (isAjax) return res.status(500).json({ success: false, error: String(error) });
      res.redirect('/admin/product-list');
    });
};
