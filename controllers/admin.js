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
  req.user.getProducts({ where: {id: productId} })
    .then((products) => {
      const product = products[0];
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Add Product",
        path: "/admin/edit-product",
        editing: true,
        product: product,
      });
    })
    .catch((error) => {
      console.log("Error in Admin Controller, getEditProduct: {}", error);
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
  if (!req.user || typeof req.user.getProducts !== 'function') return renderLogin(req, res);
  req.user.getProducts()
    .then((products) => {
      res.render("admin/product-list", {
        pageTitle: "Admin Products",
        path: "/admin/product-list",
        prods: products,
        hasProducts: products.length > 0,
      });
    })
    .catch((error) =>
      console.log("Error in Admin Controller, getProducts: {}", error)
    );
};

// orders listing
exports.getOrders = async (req, res) => {
  if (!req.user) return renderLogin(req, res);
  try {
    const status = req.query.status;
    const where = {};
    if (status) where.status = status.charAt(0).toUpperCase() + status.slice(1);
    const orders = await Order.findAll({
      where,
      order: [['createdAt','DESC']],
      include: [
        { model: User, attributes: ['id','name','email'] },
        { model: OrderItem, as: 'orderItems', include: [{ model: Product, as: 'product' }] }
      ]
    });
    res.render('admin/orders', { pageTitle: 'Orders', path: '/admin/orders', orders });
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
      product.destroy();
    })
    .then((result) => {
      (result) => console.log("destroyed successfully", result);
      res.redirect("/admin/product-list");
    })
    .catch((error) =>
      console.log("Error in Admin Controller, deleteProduct: {}", error)
    );
};
