/**
 * Authentication and Authorization Middleware
 * Provides role-based access control for routes
 */

/**
 * Ensure user is authenticated
 */
exports.ensureAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }

  // For API requests, return JSON
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // For page requests, redirect to login
  req.flash('error', 'Please login to access this page');
  return res.redirect('/login');
};

/**
 * Ensure user has Administrator role
 */
exports.ensureAdmin = (req, res, next) => {
  // Debug logging
  console.log('=== ensureAdmin Middleware ===');
  console.log('req.user exists:', !!req.user);
  if (req.user) {
    console.log('User ID:', req.user.id);
    console.log('User email:', req.user.email);
    console.log('User role exists:', !!req.user.role);
    if (req.user.role) {
      console.log('Role name:', req.user.role.name);
      console.log('Role ID:', req.user.role.id);
    }
    console.log('User roleId field:', req.user.roleId);
  }
  console.log('==============================');

  if (!req.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }

  if (req.user.role && req.user.role.name === 'Administrator') {
    return next();
  }

  // Access denied - log why
  console.error('ADMIN ACCESS DENIED for user:', req.user.email);
  console.error('Reason: Role is', req.user.role ? req.user.role.name : 'NULL');

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return res.status(403).render('error/403', {
    pageTitle: 'Access Denied',
    path: '',
    errorMessage: 'Administrator access required'
  });
};

/**
 * Ensure user has Warehouse role
 */
exports.ensureWarehouse = (req, res, next) => {
  if (!req.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }

  if (req.user.role && (req.user.role.name === 'Warehouse' || req.user.role.name === 'Administrator')) {
    return next();
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(403).json({ error: 'Warehouse access required' });
  }

  return res.status(403).render('error/403', {
    pageTitle: 'Access Denied',
    path: '',
    errorMessage: 'Warehouse access required'
  });
};

/**
 * Ensure user has Finance role
 */
exports.ensureFinance = (req, res, next) => {
  if (!req.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }

  if (req.user.role && (req.user.role.name === 'Finance' || req.user.role.name === 'Administrator')) {
    return next();
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(403).json({ error: 'Finance access required' });
  }

  return res.status(403).render('error/403', {
    pageTitle: 'Access Denied',
    path: '',
    errorMessage: 'Finance access required'
  });
};

/**
 * Ensure user has Delivery role
 */
exports.ensureDelivery = (req, res, next) => {
  if (!req.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }

  if (req.user.role && (req.user.role.name === 'Delivery' || req.user.role.name === 'Administrator')) {
    return next();
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(403).json({ error: 'Delivery access required' });
  }

  return res.status(403).render('error/403', {
    pageTitle: 'Access Denied',
    path: '',
    errorMessage: 'Delivery access required'
  });
};

/**
 * Ensure user is Customer role (for customer-only features)
 */
exports.ensureCustomer = (req, res, next) => {
  if (!req.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }

  if (req.user.role && req.user.role.name === 'Customer') {
    return next();
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
    return res.status(403).json({ error: 'Customer access only' });
  }

  return res.status(403).render('error/403', {
    pageTitle: 'Access Denied',
    path: '',
    errorMessage: 'This page is for customers only'
  });
};

/**
 * Check if user has any of the specified roles
 * Usage: ensureRoles(['Administrator', 'Warehouse'])
 */
exports.ensureRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.flash('error', 'Please login to access this page');
      return res.redirect('/login');
    }

    if (req.user.role && allowedRoles.includes(req.user.role.name)) {
      return next();
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return res.status(403).render('error/403', {
      pageTitle: 'Access Denied',
      path: '',
      errorMessage: 'You do not have permission to access this page'
    });
  };
};

/**
 * Redirect authenticated users away from auth pages (login/register)
 */
exports.redirectIfAuthenticated = (req, res, next) => {
  if (req.user) {
    // Redirect based on role
    if (req.user.role) {
      switch (req.user.role.name) {
        case 'Administrator':
          return res.redirect('/admin/dashboard');
        case 'Warehouse':
          return res.redirect('/warehouse/dashboard');
        case 'Finance':
          return res.redirect('/payment/dashboard');
        case 'Delivery':
          // Delivery users should be redirected to delivery dashboard
          return res.redirect('/delivery/dashboard');
        case 'Customer':
        default:
          return res.redirect('/customer/dashboard');
      }
    }
    return res.redirect('/customer/dashboard');
  }
  next();
};
