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

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/category");
const paymentRoutes = require("./routes/payment");
const warehouseRoutes = require("./routes/warehouse");

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})

app.use(helmet());
app.use(compression());
app.use(morgan('combined', {stream: accessLogStream}));


app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Commented out old user middleware - will use authentication from /auth routes instead
/*
app.use((req, res, next) => {
  User.findByPk(1)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((error) => {
      console.log("Error in App.js, in user retrieval, {}", error);
    });
});

app.use(session({
  secret: "Celesi", 
  resave: false,                    
  saveUninitialized: false         
}));

app.use((req, res, next) => {
  if (req.method === "POST"){
    next();
    return;
  }
  console.log("got her");
  console.log( "sessoip nn", req.session.user);
  if (!req.session.user){
    res.render("user/index", {errorMessage : ""});
  }
  else next(); 
});


app.post("/login", async (req, res) => {
  req.session.user = "1";
  res.send("ok");
});


app.post("/logoutnow", async (req, res) => {
  console.log("destroy");
  req.session.user = "";
  res.render("user/index", {errorMessage : ""});
});
*/

// Old login routes commented out - use /auth routes instead

app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/categories", categoryRoutes);
app.use("/payment", paymentRoutes);
app.use("/warehouse", warehouseRoutes);
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

// Order-Payment relationship (one-to-one)
Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Order-Shipment relationship (one-to-one)
Order.hasOne(Shipment, { foreignKey: 'orderId', as: 'shipment' });
Shipment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Product-Inventory relationship (inventory log)
Inventory.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Inventory, { foreignKey: 'productId', as: 'inventoryHistory' });

// Sync database and start server
sequelize
  .sync()
  .then(() => {
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
      console.log(`  /categories/* - Categories`);
      console.log(`  /payment/* - Payment`);
      console.log(`  /warehouse/* - Warehouse`);
      console.log(`  /admin/* - Admin`);
      console.log(`  /* - Shop`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
