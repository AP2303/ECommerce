const Product = require("../models/product");
const Cart = require("../models/cart");

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
  if (!req.user || typeof req.user.getCart !== 'function') {
    return renderLogin(req, res);
  }
  const productId = req.body.productId;
  let fetchedCart;
  let newQuantity = 1;

  req.user.getCart()
    .then(cart => {
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
      return fetchedCart.addProduct(product, {
        through: { quantity: newQuantity }
      })
    })
    .then(() => {
      res.redirect("/cart");
    })
    .catch(error => { console.log(error); renderLogin(req, res); });

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
