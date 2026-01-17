const Product = require("../models/product");
const Cart = require("../models/cart");
const CartItem = require('../models/cart-item');

const ERROR_PREFIX = "In shop controller, ";

function renderLogin(req, res) {
  // Render a simple login prompt page used by the app
  return res.render('user/index', { errorMessage: 'Please login to access this page' });
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
  if (!req.user || typeof req.user.getCart !== 'function') {
    return renderLogin(req, res);
  }
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
};

exports.postCart = (req, res, next) => {
  // If AJAX request and not authenticated, return 401 JSON
  const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
  const productId = parseInt(req.body.productId, 10);
  console.log('POST /cart called, isAjax=', isAjax, 'productId=', productId, 'userId=', req.user ? req.user.id : 'null');
  if (!req.user || typeof req.user.getCart !== 'function') {
    console.log('postCart: user not authenticated or no getCart');
    if (isAjax) {
      return res.status(401).json({ error: 'not_authenticated' });
    }
    return renderLogin(req, res);
  }

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

};

exports.postCartDeleteProduct = (req, res, next) => {
  if (!req.user || typeof req.user.getCart !== 'function') {
    return renderLogin(req, res);
  }
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
