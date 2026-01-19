const Product = require("../models/product");
const Cart = require("../models/cart");
const CartItem = require('../models/cart-item');
const Order = require('../models/order');
const { randomUUID } = require('crypto');

const ERROR_PREFIX = "In shop controller, ";

function renderLogin(req, res) {
  // Render a simple login prompt page used by the app
  return res.render('user/index', { errorMessage: 'Please login to access this page' });
}

// Helper to generate a unique order number
function generateOrderNumber() {
  const timestamp = Date.now();
  const rand = Math.floor(Math.random() * 90000) + 10000; // 5 digit random
  return `ORD-${timestamp}-${rand}`;
}

exports.getProducts = (req, res, next) => {
  Product.findAll()
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products List",
        path: "/shop/product-list",
        hasProducts: products.length > 0,
      });
    })
    .catch((error) => {
      console.log("In shop controller, fetchAll: {}", error);
    });
};

exports.getProduct = (req, res, next) => {
  const productId = req.params.productId;
  Product.findByPk(productId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((error) => console.log("{} getProduct, {}", ERROR_PREFIX, error));
};

exports.getIndex = (req, res, next) => {
  Product.findAll()
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        hasProducts: products.length > 0,
      });
    })
    .catch((error) => {
      console.log("In shop controller, fetchAll: {}", error);
    });
};

exports.getCart = (req, res, next) => {
  // If user is authenticated, use DB-backed cart
  if (req.user && typeof req.user.getCart === 'function') {
    req.user.getCart()
      .then(cart => {
        if (!cart) {
          return res.render("shop/cart", { pageTitle: "Cart", path: "/shop/cart", products: [] });
        }
        return cart.getProducts()
          .then(products => {
            res.render("shop/cart", {
              pageTitle: "Cart",
              path: "/shop/cart",
              products: products,
            });
          })
      })
      .catch(error => { console.log('Error in shop controller, getCart {}', error); renderLogin(req, res); });
    return;
  }

  // Try to use persistent guest cart via cookie
  const guestToken = req.cookies && req.cookies.guestCartToken;
  if (guestToken) {
    return Cart.findOne({ where: { guestToken }, include: [{ model: require('../models/product') }] })
      .then(cart => {
        if (!cart) {
          // invalid token, clear cookie and fallback
          res.clearCookie('guestCartToken');
          return res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products: [] });
        }
        // map products to view shape
        return cart.getProducts().then(products => {
          // products are models; ensure cartItem quantity available
          res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products });
        })
      })
      .catch(err => { console.error('getCart guest DB error', err); res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products: [] }); });
  }

  // Guest cart stored in session (legacy)
  const sessionCart = req.session.cart || {};
  const productIds = Object.keys(sessionCart).map(id => parseInt(id, 10));
  if (!productIds.length) {
    return res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products: [] });
  }
  Product.findAll({ where: { id: productIds } })
    .then(products => {
      // attach cartItem.quantity simulated from session
      const mapped = products.map(p => {
        p = p.get ? p.get({ plain: true }) : p;
        p.cartItem = { quantity: sessionCart[p.id] || 1 };
        return p;
      });
      // We returned raw objects; render expects model-like objects, so pass mapped
      return res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products: mapped });
    })
    .catch(err => { console.error('getCart guest error', err); res.render('shop/cart', { pageTitle: 'Cart', path: '/shop/cart', products: [] }); });
};

exports.postCart = (req, res, next) => {
  // If AJAX request and not authenticated, return 401 JSON
  const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
  const productId = parseInt(req.body.productId, 10);
  console.log('POST /cart called, isAjax=', isAjax, 'productId=', productId, 'userId=', req.user ? req.user.id : 'null');

  if (req.user && typeof req.user.getCart === 'function') {
    // Existing DB-backed logic
    let fetchedCart;
    let newQuantity = 1;

    req.user.getCart()
      .then(cart => {
        if (!cart) {
          console.log('postCart: No cart found for user, creating one');
          return req.user.createCart().then(newCart => {
            fetchedCart = newCart;
            return newCart.getProducts({ where: { id: productId } });
          });
        }
        fetchedCart = cart;
        return cart.getProducts({ where: { id: productId } })
      })
      .then(products => {
        let product;
        if (products.length > 0) {
          product = products[0];
        }
        if (product) {
          newQuantity = product.cartItem.quantity + 1;
          return product;
        }
        return Product.findByPk(productId);
      })
      .then(product => {
        if (!product) throw new Error('Product not found: ' + productId);
        console.log('postCart: about to add product to cart, fetchedCart id=', fetchedCart && fetchedCart.id, 'product id=', product.id, 'product title=', product.title);
        console.log('postCart: fetchedCart methods: addProduct=', fetchedCart && typeof fetchedCart.addProduct);
        try {
          if (fetchedCart && typeof fetchedCart.addProduct === 'function') {
            return fetchedCart.addProduct(product, {
              through: { quantity: newQuantity }
            });
          } else {
            console.warn('postCart: association helper addProduct not available, using CartItem fallback');
            // upsert cart item
            return CartItem.findOne({ where: { cartId: fetchedCart.id, productId: product.id } })
              .then(existing => {
                if (existing) {
                  existing.quantity = newQuantity;
                  return existing.save();
                }
                return CartItem.create({ cartId: fetchedCart.id, productId: product.id, quantity: newQuantity });
              });
          }
        } catch (err) {
          console.error('postCart: synchronous error during addProduct/fallback', err);
          throw err;
        }
      })
      .then(async () => {
        try {
          if (isAjax) {
            // compute cart count and return it
            const productsInCart = await fetchedCart.getProducts();
            console.log('postCart: AJAX success, cartCount=', productsInCart.length);
            return res.json({ success: true, cartCount: productsInCart.length });
          }
          console.log('postCart: non-AJAX success, redirecting to /cart');
          res.redirect("/cart");
        } catch (err) {
          console.error('postCart: error computing cart count', err);
          if (isAjax) return res.json({ success: true });
          res.redirect('/cart');
        }
      })
      .catch(error => {
        console.error('postCart: caught error', error);
        if (isAjax) return res.status(500).json({ error: 'server_error', message: String(error) });
        renderLogin(req, res);
      });

    return;
  }

  // Guest user: try to persist cart in DB via guestCartToken cookie
  try {
    const productId = productId || parseInt(req.body.productId, 10);
    let guestToken = req.cookies && req.cookies.guestCartToken;
    if (!guestToken) {
      // Use crypto.randomUUID() for a secure unique token
      guestToken = randomUUID();
       // set cookie for 1 year
       res.cookie('guestCartToken', guestToken, { maxAge: 365*24*60*60*1000, httpOnly: true });
    }

    // find or create cart
    Cart.findOrCreate({ where: { guestToken }, defaults: { guestToken } })
      .then(async ([cart, created]) => {
        try {
          // If cart was just created and there is a legacy session cart, migrate items
          const sessionCartSnapshot = req.session && req.session.cart ? req.session.cart : null;
          if (created && sessionCartSnapshot && Object.keys(sessionCartSnapshot).length) {
            const pidList = Object.keys(sessionCartSnapshot).map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n));
            if (pidList.length) {
              const productsToMigrate = await require('../models/product').findAll({ where: { id: pidList } });
              for (const p of productsToMigrate) {
                const qty = sessionCartSnapshot[p.id] || 1;
                await cart.addProduct(p, { through: { quantity: qty } });
              }
              // clear legacy session cart
              delete req.session.cart;
            }
          }

          // add product to cart via association (also handles when migrated)
          return cart.getProducts({ where: { id: productId } })
            .then(products => {
              if (products && products.length > 0) {
                const product = products[0];
                const newQuantity = (product.cartItem && product.cartItem.quantity ? product.cartItem.quantity : 0) + 1;
                return product.cartItem.update({ quantity: newQuantity });
              }
              return require('../models/product').findByPk(productId).then(prod => {
                if (!prod) throw new Error('Product not found');
                return cart.addProduct(prod, { through: { quantity: 1 } });
              });
            })
        } catch (mErr) {
          console.error('Error during guest cart migration/add', mErr);
          throw mErr;
        }
      })
      .then(() => {
        if (isAjax) return res.json({ success: true, cartCount: 1 });
        return res.redirect('/cart');
      })
      .catch(err => {
        console.error('postCart guest DB error', err);
        // fallback to session
        if (!req.session.cart) req.session.cart = {};
        const current = req.session.cart[productId] ? parseInt(req.session.cart[productId], 10) : 0;
        req.session.cart[productId] = current + 1;
        req.session.save(e => { if (e) console.error('session.save', e); if (isAjax) return res.json({ success: true, cartCount: Object.keys(req.session.cart).length }); return res.redirect('/cart'); });
      });

  } catch (err) {
    console.error('postCart guest error', err);
    if (isAjax) return res.status(500).json({ error: 'server_error', message: String(err) });
    return renderLogin(req, res);
  }
};

exports.postCartDeleteProduct = (req, res, next) => {
  if (req.user && typeof req.user.getCart === 'function') {
    const productId = req.body.productId;
    req.user.getCart()
      .then(cart => {
        return cart.getProducts({ where: { id: productId } })
      })
      .then(products => {
        const product = products[0];
        return product.cartItem.destroy();
      })
      .then(result => {
        res.redirect("/cart");
      })
      .catch(error => { console.log(error); renderLogin(req, res); });
    return;
  }

  // Guest: remove from session cart
  const productId = req.body.productId;
  if (req.session && req.session.cart && req.session.cart[productId]) {
    delete req.session.cart[productId];
    req.session.save(err => { if (err) console.error('session.save', err); return res.redirect('/cart'); });
  } else {
    return res.redirect('/cart');
  }
};

// Create an Order from the current cart for payment, but do NOT clear the cart yet
exports.postCreateOrderForPayment = async (req, res, next) => {
  console.log('POST /create-order-for-payment called; userId=', req.user && req.user.id, 'sessionId=', req.sessionID);
  try {
    // Log session cart (do not log entire session in production)
    try { console.log('session.cart snapshot:', JSON.stringify(req.session && req.session.cart || {})); } catch(e){ console.warn('failed to stringify session cart',e); }

    // Prefer DB-backed cart for authenticated users when possible
    if (req.user && req.user.id) {
      // try to safely get the cart; if helper not available, fallback to session
      try {
        if (typeof req.user.getCart === 'function') {
          const cart = await req.user.getCart();
          if (!cart) return res.status(400).json({ error: 'cart_empty' });
          const products = await cart.getProducts();
          if (!products || products.length === 0) return res.status(400).json({ error: 'cart_empty' });

          // Compute total from DB cart without creating an Order to avoid DB schema issues during dev
          try {
            const totalAmount = products.reduce((s, p) => s + (p.price || 0) * (p.cartItem && p.cartItem.quantity ? p.cartItem.quantity : 1), 0);
            console.log('Computed totalAmount from DB cart for user', req.user.id, 'total=', totalAmount);
            // Return totalAmount; do not persist order here. Client will call /payment/create with amount fallback or supply orderId.
            return res.json({ success: true, orderId: null, totalAmount });
          } catch (computeErr) {
            console.warn('postCreateOrderForPayment: failed computing total from DB cart, falling back to session. Error:', computeErr && (computeErr.stack || computeErr.message || computeErr));
            // fall through to session fallback
          }
        }
      } catch (innerErr) {
        console.warn('postCreateOrderForPayment: DB cart path failed, falling back to session. Error:', innerErr && (innerErr.stack || innerErr.message || innerErr));
        // fall through to session fallback
      }
    }

    // Guest or fallback using session cart
    const sessionCart = req.session && req.session.cart ? req.session.cart : {};
    const productIds = Object.keys(sessionCart).map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n));
    if (!productIds.length) return res.status(400).json({ error: 'cart_empty' });

    const products = await Product.findAll({ where: { id: productIds } });
    if (!products || products.length === 0) return res.status(400).json({ error: 'cart_empty' });

    // compute total and create order (no user relationship)
    const totalAmount = products.reduce((s, p) => s + (p.price || 0) * (sessionCart[p.id] || 1), 0);
    const orderNumber = generateOrderNumber();
    const order = await Order.create({ totalAmount, orderNumber, currency: 'GBP' });
    await order.addProducts(products.map(p => { p.orderItem = { quantity: sessionCart[p.id] || 1 }; return p; }));

    console.log('Created order from session cart, orderId=', order.id);
    return res.json({ success: true, orderId: order.id, totalAmount: order.totalAmount });
  } catch (err) {
    console.error('postCreateOrderForPayment fatal error:', err && (err.stack || err.message || err));
    // Return an informative error to client for debugging in development
    return res.status(500).json({ error: 'failed', message: err && (err.message || String(err)) });
  }
};

exports.getOrders = (req, res, next) => {
  if (!req.user || typeof req.user.getOrders !== 'function') {
    return renderLogin(req, res);
  }
  req.user
    .getOrders({ include: [Product] })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => { console.log(err); renderLogin(req, res); });
};

exports.postOrder = (req, res, next) => {
  if (!req.user || typeof req.user.getCart !== 'function') {
    return renderLogin(req, res);
  }
  let fetchedCart;
  req.user
    .getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts();
    })
    .then(products => {
      return req.user
        .createOrder()
        .then(order => {
          return order.addProducts(
            products.map(product => {
              product.orderItem = { quantity: product.cartItem.quantity };
              return product;
            })
          );
        })
        .catch(err => { console.log(err); renderLogin(req, res); });
    })
    .then(result => {
      return fetchedCart.setProducts(null);
    })
    .then(result => {
      res.redirect('/orders');
    })
    .catch(err => { console.log(err); renderLogin(req, res); });
};

exports.getProductApi = (req, res, next) => {
  const productId = req.params.productId;
  Product.findByPk(productId)
    .then(product => {
      if (!product) return res.status(404).json({ error: 'not_found' });
      // compute imageSrc similar to views
      let imageSrc = '/images/placeholder.svg';
      if (product.imageUrl) {
        const v = String(product.imageUrl).trim();
        if (v.indexOf('http') === 0) {
          imageSrc = '/images/proxy?src=' + encodeURIComponent(v);
        } else if (v.indexOf('/') === 0) {
          imageSrc = v;
        } else {
          imageSrc = '/images/' + v;
        }
      }
      return res.json({ id: product.id, title: product.title, price: product.price, description: product.description, stock: product.stock, imageUrl: product.imageUrl, imageSrc });
    })
    .catch(err => res.status(500).json({ error: 'server_error', message: String(err) }));
};
