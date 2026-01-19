require('dotenv').config();
const path = require("path");
const fs = require('fs');
const session = require("express-session");
const flash = require("connect-flash");

const errorController = require("./controllers/error");
const sequelize = require("./util/database");
const Product = require("./models/product");
const User = require("./models/user");
const Cart = require("./models/cart");
const CartItem = require("./models/cart-item");
const Order = require("./models/order");
const OrderItem = require("./models/order-item");
const Role = require("./models/role");
const Category = require("./models/category");
const Payment = require("./models/payment");
const Inventory = require("./models/inventory");
const Shipment = require("./models/shipment");
// const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const express = require("express");
const bodyParser = require("body-parser");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authController = require('./controllers/auth');
const roleAuth = require('./middleware/roleAuth');
const dashboardController = require('./controllers/dashboard');
const userController = require('./controllers/user');

const app = express();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' // HTTPS in production
  }
}));

app.use(flash());

app.set("view engine", "ejs");
app.set("views", "views");

// parse incoming JSON for fetch requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Simple image proxy for allowlisted hosts to bypass strict CSP (development helper)
// Register this BEFORE static so it is matched reliably and to provide diagnostics.
app.get('/images/proxy', async (req, res) => {
  try {
    let src = req.query.src;
    console.log('Image proxy hit, raw src=', src);
    if (!src) return res.status(400).send('Missing src');

    // Sometimes src can be double-encoded; decode once safely
    try { src = decodeURIComponent(src); } catch (e) { /* ignore */ }

    let parsed;
    try {
      parsed = new URL(src);
    } catch (e) {
      console.warn('Image proxy invalid URL:', src);
      return res.status(400).send('Invalid URL');
    }

    const allowedHosts = [
      'covers.openlibrary.org',
      'images.unsplash.com',
      'cdn.pixabay.com',
      'upload.wikimedia.org'
    ];

    console.log('Image proxy request for host:', parsed.hostname);
    // Allow exact matches or openlibrary subdomains
    const isAllowed = allowedHosts.includes(parsed.hostname) || parsed.hostname.endsWith('.openlibrary.org') || parsed.hostname === 'openlibrary.org';
    if (!isAllowed) {
      console.warn('Image proxy blocked host:', parsed.hostname);
      return res.status(403).send('Host not allowed');
    }

    // Fetch with a minimal user-agent and accept headers to improve compatibility
    const fetchRes = await fetch(src, {
      headers: {
        'User-Agent': 'BookLabStore/1.0 (+https://localhost)',
        'Accept': 'image/*,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    console.log('Image proxy remote status:', fetchRes.status, 'for', src);
    if (!fetchRes.ok) {
      console.warn('Image proxy fetch failed:', fetchRes.status, src);
      if (fetchRes.status === 404) {
        // Return local placeholder image instead of 404 so browser receives an image
        const placeholderPath = path.join(__dirname, 'public', 'images', 'placeholder.svg');
        if (fs.existsSync(placeholderPath)) {
          res.setHeader('Content-Type', 'image/svg+xml');
          return fs.createReadStream(placeholderPath).pipe(res);
        }
        return res.status(404).send('Remote image not found');
      }
      return res.status(502).send('Failed to fetch image');
    }

    const contentType = fetchRes.headers.get('content-type') || '';
    console.log('Image proxy remote content-type:', contentType);
    // Ensure remote is an image
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.warn('Image proxy remote content-type not an image:', contentType, src);
      return res.status(415).send('Remote resource is not an image');
    }
    res.setHeader('Content-Type', contentType);
    // cache for a day
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream the image
    const body = fetchRes.body;
    if (body && body.pipe) {
      return body.pipe(res);
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(500).send('Proxy error');
  }
});

// Diagnostic endpoint to test proxy fetch capability
app.get('/images/proxy-test', async (req, res) => {
  try {
    const testUrl = 'https://covers.openlibrary.org/b/id/11153255-L.jpg';
    console.log('Proxy-test fetching', testUrl);
    const fetchRes = await fetch(testUrl, { headers: { 'User-Agent': 'BookLabStore/1.0' } });
    const status = fetchRes.status;
    const contentType = fetchRes.headers.get('content-type') || '';
    const length = fetchRes.headers.get('content-length') || 'unknown';
    res.json({ status, contentType, length });
  } catch (err) {
    console.error('Proxy-test error', err);
    res.status(500).json({ error: 'proxy-test-failed', message: String(err) });
  }
});

app.use(express.static(path.join(__dirname, "public")));

// Quick login/logout endpoints (front-end uses these paths)
app.post('/login', authController.postLogin);
app.post('/logoutnow', authController.postLogout);

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");
const paymentRoutes = require("./routes/payment");
const warehouseRoutes = require("./routes/warehouse");

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})


// Set Permissions-Policy to allow payment features (silences PayPal warnings)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'payment=*');
  next();
});

// Use a permissive CSP during development to allow PayPal Sandbox, conversion pixels and image proxies to function.
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow PayPal scripts (live & sandbox) and inline execution needed by the SDK
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.paypal.com', 'https://www.paypalobjects.com', 'https://www.sandbox.paypal.com', 'https://www.sandbox.paypalobjects.com', 'https://*.paypal.com', 'https://*.paypalobjects.com'],
        // Allow inline event handlers (development helper) - in production lock this down
        scriptSrcAttr: ["'unsafe-inline'"],
        // Allow HTTPS styles (e.g., Google Fonts) and inline styles used in templates
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        // Allow fonts and data URIs
        fontSrc: ["'self'", 'https:', 'data:'],
        // Allow images from any HTTPS origin and data URIs; image proxy will enforce a host allowlist
        imgSrc: ["'self'", 'data:', 'https:'],
        // Allow connections to PayPal APIs, sandbox logger endpoints and Google ad/conversion hosts
        connectSrc: [
          "'self'",
          'https://api-m.sandbox.paypal.com',
          'https://api-m.paypal.com',
          'https://www.sandbox.paypal.com',
          'https://www.paypal.com',
          'https://*.paypal.com',
          'https://c.paypal.com',
          'https://www.google.com',
          'https://www.google-analytics.com',
          'https://www.googleadservices.com',
          'https://pagead2.googlesyndication.com',
          'https://www.googletagmanager.com'
        ],
        // Allow frames from PayPal (sandbox & live)
        frameSrc: ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com', 'https://*.paypal.com', 'https://www.paypalobjects.com', 'https://www.sandbox.paypalobjects.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://www.sandbox.paypal.com', 'https://www.paypal.com']
      }
    }
  }));
}
app.use(compression());
app.use(morgan('combined', {stream: accessLogStream}));


app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Load user from session into req.user
app.use(async (req, res, next) => {
  try {
    let user = null;
    if (req.session && req.session.userId) {
      console.log('Loading user from session, userId:', req.session.userId);
      user = await User.findByPk(req.session.userId, { include: [{ model: Role, as: 'role' }] });
      if (user) {
        console.log('User loaded:', user.email, 'Role:', user.role ? user.role.name : 'NO ROLE');
      } else {
        console.log('User not found for session userId:', req.session.userId);
      }
    } else {
      console.log('No active session');
    }

    req.user = user || null;

    // Expose auth state & role to views
    res.locals.isAuthenticated = !!req.user;
    res.locals.currentUser = req.user;
    res.locals.currentRole = req.user && req.user.role ? req.user.role.name : null;

    // Expose PayPal client ID and mode for client-side SDK (views can read these)
    res.locals.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
    res.locals.PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

    // Compute cartCount for header if user exists
    res.locals.cartCount = 0;
    if (req.user) {
      try {
        const userCart = await req.user.getCart();
        if (userCart) {
          const cartProducts = await userCart.getProducts();
          res.locals.cartCount = cartProducts.length;
        }
      } catch (err) {
        console.warn('Failed to compute cartCount for user:', err);
        res.locals.cartCount = 0;
      }
    }

    next();
  } catch (err) {
    console.error('Error in user-loading middleware:', err);
    next(err);
  }
});

// Welcome page at root (public - no authentication required)
app.get('/', (req, res) => {
  // Check if user is logged in
  const isLoggedIn = req.user ? true : false;
  const userRole = req.user && req.user.role ? req.user.role.name : null;

  res.render('welcome', {
    pageTitle: 'Welcome to Our Book Store',
    path: '/',
    isLoggedIn,
    userRole,
    userName: req.user ? req.user.name : null
  });
});

// Development-only debug endpoint to inspect session/user (do not enable in production)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/whoami', (req, res) => {
    return res.json({
      session: req.session || null,
      user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role ? req.user.role.name : null } : null,
      localsRole: res.locals.currentRole || null
    });
  });

  // Development helper: inspect shipments model vs raw SQL to debug schema mismatches
  app.get('/debug/shipments', async (req, res) => {
    try {
      const Shipment = require('./models/shipment');
      const sequelize = require('./util/database');
      const out = { modelQuery: null, modelError: null, rawQuery: null, rawError: null };
      try {
        const m = await Shipment.findAll({ limit: 10 });
        out.modelQuery = m.map(s => (s.get ? s.get({ plain: true }) : s));
      } catch (me) {
        out.modelError = me && (me.stack || me.message || String(me));
      }

      try {
        const [rows] = await sequelize.query('SELECT * FROM "shipments" LIMIT 10');
        out.rawQuery = rows;
      } catch (re) {
        out.rawError = re && (re.stack || re.message || String(re));
      }

      res.json(out);
    } catch (err) {
      res.status(500).json({ error: 'debug_failed', message: String(err), stack: err.stack });
    }
  });

  // Development helper: inspect payments model vs raw SQL
  app.get('/debug/payments', async (req, res) => {
    try {
      const Payment = require('./models/payment');
      const sequelize = require('./util/database');
      const out = { modelQuery: null, modelError: null, rawQuery: null, rawError: null };
      try {
        const m = await Payment.findAll({ limit: 10 });
        out.modelQuery = m.map(p => (p.get ? p.get({ plain: true }) : p));
      } catch (me) {
        out.modelError = me && (me.stack || me.message || String(me));
      }

      try {
        const [rows] = await sequelize.query('SELECT * FROM "payments" LIMIT 10');
        out.rawQuery = rows;
      } catch (re) {
        out.rawError = re && (re.stack || re.message || String(re));
      }

      res.json(out);
    } catch (err) {
      res.status(500).json({ error: 'debug_failed', message: String(err), stack: err.stack });
    }
  });
}

// Auth page routes - accessible even if logged in (will show appropriate message)
app.get('/login', (req, res) => {
  const errors = req.flash ? req.flash('error') : [];
  const isLoggedIn = req.user ? true : false;
  res.render('user/index', {
    errorMessage: errors,
    isLoggedIn,
    userName: req.user ? req.user.name : null
  });
});

app.get('/register', (req, res) => {
  const isLoggedIn = req.user ? true : false;
  res.render('auth/register', {
    isLoggedIn,
    userName: req.user ? req.user.name : null
  });
});

// Dashboard routes - role-specific
app.get('/customer/dashboard', roleAuth.ensureAuthenticated, dashboardController.getCustomerDashboard);
app.get('/admin/dashboard', roleAuth.ensureAdmin, dashboardController.getAdminDashboard);
app.get('/warehouse/dashboard', roleAuth.ensureRoles(['Warehouse', 'Administrator']), dashboardController.getWarehouseDashboard);
app.get('/payment/dashboard', roleAuth.ensureRoles(['Finance', 'Administrator']), dashboardController.getFinanceDashboard);
app.get('/delivery/dashboard', roleAuth.ensureRoles(['Delivery', 'Administrator']), dashboardController.getDeliveryDashboard);

// API routes
app.get('/api/roles', roleAuth.ensureAdmin, userController.getRoles);

// Mount routes with role-based protection
app.use('/admin', roleAuth.ensureAdmin, adminRoutes);
app.use('/warehouse', roleAuth.ensureRoles(['Warehouse', 'Administrator']), warehouseRoutes);
// Payment routes are mounted publicly; sensitive endpoints are protected inside routes/payment.js
app.use('/payment', paymentRoutes);
app.use('/delivery', roleAuth.ensureRoles(['Delivery', 'Administrator']), require('./routes/delivery'));

app.use("/auth", authRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

// ============================================
// DATABASE RELATIONSHIPS
// ============================================

// User-Role relationship
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId' });

// Product-User relationship (who created the product)
Product.belongsTo(User, { constraints: true, onDelete: "CASCADE", foreignKey: 'userId' });
User.hasMany(Product, { foreignKey: 'userId' });

// Product-Category relationship
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Product, { foreignKey: 'categoryId' });

// User-Cart relationship
User.hasOne(Cart, { foreignKey: 'userId' });
Cart.belongsTo(User, { foreignKey: 'userId' });

// Cart-Product relationship (through CartItem)
Cart.belongsToMany(Product, { through: CartItem, foreignKey: 'cartId' });
Product.belongsToMany(Cart, { through: CartItem, foreignKey: 'productId' });

// User-Order relationship
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Order, { foreignKey: 'userId' });

// Order-Product relationship (through OrderItem)
Order.belongsToMany(Product, { through: OrderItem, foreignKey: 'orderId' });
Product.belongsToMany(Order, { through: OrderItem, foreignKey: 'productId' });

// Ensure direct OrderItem associations exist for easier includes
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });

// Order-Payment relationship (one-to-one)
Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Order-Shipment relationship (one-to-one)
// Use explicit foreignKey object with name and field to match existing DB column 'orderId'
Order.hasOne(Shipment, { foreignKey: { name: 'orderId', field: 'order_id' }, as: 'shipment' });
Shipment.belongsTo(Order, { foreignKey: { name: 'orderId', field: 'order_id' }, as: 'order' });

// Product-Inventory relationship (inventory log)
Inventory.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Inventory, { foreignKey: 'productId', as: 'inventoryHistory' });

// Sync database and start server
const migrator = require('./util/migrator');

async function startServer() {
  try {
    const runMigrations = process.env.DB_RUN_MIGRATIONS === 'true';
    const autoMigrate = process.env.DB_AUTO_MIGRATE === 'true';

    if (runMigrations) {
      console.log('DB_RUN_MIGRATIONS=true; running pending migrations (umzug)');
      await migrator.up();
      console.log('Migrations applied');
    } else if (autoMigrate) {
      console.log('DB_AUTO_MIGRATE=true; running sequelize.sync({ alter: true })');
      await sequelize.sync({ alter: true });
      console.log('Auto-migration complete');
    } else {
      await sequelize.authenticate();
    }

    // Development-only seed: ensure at least one user and roles exist so req.user fallback works
    if (process.env.NODE_ENV !== 'production') {
      const userCount = await User.count();
      if (userCount === 0) {
        console.log('No users found in DB — creating default roles and users for development');

        const bcrypt = require('bcrypt');

        const roles = [
          { name: 'Customer', description: 'Regular customer' },
          { name: 'Administrator', description: 'Admin user' },
          { name: 'Warehouse', description: 'Inventory manager' },
          { name: 'Finance', description: 'Finance role' },
          { name: 'Delivery', description: 'Delivery role' }
        ];
        for (const r of roles) {
          await Role.findOrCreate({ where: { name: r.name }, defaults: r });
        }
        const adminRole = await Role.findOne({ where: { name: 'Administrator' } });
        const customerRole = await Role.findOne({ where: { name: 'Customer' } });

        // Hash passwords before creating users
        const adminPasswordHash = await bcrypt.hash('admin123', 12);
        const customerPasswordHash = await bcrypt.hash('customer123', 12);

        await User.findOrCreate({
          where: { email: 'admin@bookstore.com' },
          defaults: {
            name: 'Admin User',
            email: 'admin@bookstore.com',
            password: adminPasswordHash,
            roleId: adminRole.id,
            emailVerified: true,
            loginAttempts: 0,
            isLocked: false
          }
        });

        await User.findOrCreate({
          where: { email: 'customer@bookstore.com' },
          defaults: {
            name: 'Test Customer',
            email: 'customer@bookstore.com',
            password: customerPasswordHash,
            roleId: customerRole.id,
            emailVerified: true,
            loginAttempts: 0,
            isLocked: false
          }
        });

        console.log('Default dev users created (admin@bookstore.com / admin123, customer@bookstore.com / customer123)');
      }

      // Development helper: ensure guestToken column exists to avoid runtime errors
      try {
        console.log('Dev: ensuring carts.guestToken column exists');
        await sequelize.query('ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "guestToken" VARCHAR(255);');
        // create unique index if not exists to match model unique constraint
        await sequelize.query('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = \'' + 'carts_guestToken_unique_idx' + '\') THEN CREATE UNIQUE INDEX "carts_guestToken_unique_idx" ON "carts" ("guestToken"); END IF; END$$;');
        console.log('Dev: ensured carts.guestToken exists');
      } catch (fixErr) {
        console.warn('Dev: failed to ensure guestToken column/index, continuing. Error:', fixErr && (fixErr.message || fixErr));
      }

      // Development helper: ensure payments table has expected columns
      try {
        console.log('Dev: ensuring payments table columns exist');
        // add columns present in the Payment model (underscored fields)
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_id" VARCHAR(255);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "transaction_id" VARCHAR(255);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount" NUMERIC(10,2) NOT NULL DEFAULT 0;');
        // Use GBP as the default currency for this project
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT \'GBP\';');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT \'Pending\';');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP;');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payer_email" VARCHAR(255);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payer_name" VARCHAR(255);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "metadata" JSON;');
        // also ensure camelCase named columns exist to support older code
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentId" VARCHAR(255);');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "transactionId" VARCHAR(255);');

        // ensure unique index on payment_id if present
        await sequelize.query('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = \'payments_payment_id_unique_idx\') THEN CREATE UNIQUE INDEX "payments_payment_id_unique_idx" ON "payments" ("payment_id"); END IF; END$$;');

        // Make sure any existing NOT NULL constraints on payment id columns are removed so inserts can succeed
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='paymentId' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN \"paymentId\" DROP NOT NULL'; END IF; END$$;");
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_id' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN \"payment_id\" DROP NOT NULL'; END IF; END$$;");

        console.log('Dev: ensured payments table columns exist');
      } catch (payFixErr) {
        console.warn('Dev: failed to ensure payments columns, continuing. Error:', payFixErr && (payFixErr.message || payFixErr));
      }

      try {
        console.log('Dev: ensuring payments.createdAt and payments.updatedAt exist');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        await sequelize.query('ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        // Also add snake_case timestamp columns to support raw SQL or older code that expects created_at/updated_at
        await sequelize.query("ALTER TABLE \"payments\" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;");
        await sequelize.query("ALTER TABLE \"payments\" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;");

        // Ensure timestamps are nullable or have defaults
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='createdAt' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN \"createdAt\" DROP NOT NULL'; END IF; END$$;");
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updatedAt' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN \"updatedAt\" DROP NOT NULL'; END IF; END$$;");
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='created_at' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN created_at DROP NOT NULL'; END IF; END$$;");
        await sequelize.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updated_at' AND is_nullable='NO') THEN EXECUTE 'ALTER TABLE \"payments\" ALTER COLUMN updated_at DROP NOT NULL'; END IF; END$$;");
        console.log('Dev: ensured payments timestamps exist (camelCase + snake_case)');
      } catch (tsErr) {
        console.warn('Dev: failed to ensure payments timestamps:', tsErr && (tsErr.message || tsErr));
      }
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Database connected successfully`);
      console.log(`✓ All routes mounted and ready`);
      console.log(`\nTest Accounts:`);
      console.log(`  Admin:    admin@bookstore.com / admin123`);
      console.log(`  Customer: customer@bookstore.com / customer123`);
      console.log(`\nAvailable endpoints:`);
      console.log(`  /auth/* - Authentication`);
      console.log(`  /payment/* - Payment`);
      console.log(`  /warehouse/* - Warehouse`);
      console.log(`  /admin/* - Admin`);
      console.log(`  /* - Shop`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

