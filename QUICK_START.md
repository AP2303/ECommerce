# Quick Start Guide

## Current Status
✅ Database connection: WORKING  
✅ All models: CREATED  
✅ All routes: MOUNTED  
⚠️ Controllers: PARTIALLY IMPLEMENTED  

## Immediate Steps to Run the Application

### Step 1: Install Missing Dependencies
```bash
cd C:\Users\Zbook\ECommerce\book-store-nodejs
npm install bcrypt express-session connect-flash express-validator helmet csurf express-rate-limit multer uuid
```

### Step 2: Test the Application
```bash
npm start
```

Expected output:
- Server should start on port 5000
- Database tables will be created automatically
- You'll see "Executing (default): SELECT..." messages

### Step 3: Test Endpoints

#### Test if server is running:
```bash
# In PowerShell
Invoke-WebRequest -Uri http://localhost:5000 -UseBasicParsing
```

#### Available Endpoints (Full List):

**Shop (Public)**
- GET http://localhost:5000/ - Homepage
- GET http://localhost:5000/product-list - Browse products
- GET http://localhost:5000/products/1 - Product detail
- GET http://localhost:5000/cart - View cart
- POST http://localhost:5000/cart - Add to cart
- POST http://localhost:5000/cart-delete-item - Remove from cart
- POST http://localhost:5000/create-order - Create order
- GET http://localhost:5000/orders - View orders

**Admin**
- GET http://localhost:5000/admin/add-product - Add product form
- POST http://localhost:5000/admin/add-product - Create product
- GET http://localhost:5000/admin/edit-product/1 - Edit product form
- POST http://localhost:5000/admin/edit-product - Update product
- GET http://localhost:5000/admin/product-list - Admin product list
- POST http://localhost:5000/admin/delete-product - Delete product

**Authentication** *(Need to implement controllers)*
- POST http://localhost:5000/auth/register
- POST http://localhost:5000/auth/login
- POST http://localhost:5000/auth/logout
- POST http://localhost:5000/auth/request-unlock
- POST http://localhost:5000/auth/verify-unlock
- GET http://localhost:5000/auth/me

**Categories** *(Need to implement controllers)*
- GET http://localhost:5000/categories
- GET http://localhost:5000/categories/1
- POST http://localhost:5000/categories (Admin)
- PUT http://localhost:5000/categories/1 (Admin)
- DELETE http://localhost:5000/categories/1 (Admin)

**Payment** *(Need to implement controllers)*
- POST http://localhost:5000/payment/create
- POST http://localhost:5000/payment/execute
- GET http://localhost:5000/payment/success
- GET http://localhost:5000/payment/cancel
- POST http://localhost:5000/payment/webhook
- GET http://localhost:5000/payment/order/1

**Warehouse** *(Need to implement controllers)*
- GET http://localhost:5000/warehouse/inventory
- POST http://localhost:5000/warehouse/stock
- GET http://localhost:5000/warehouse/orders-to-pack
- POST http://localhost:5000/warehouse/pack-order/1
- GET http://localhost:5000/warehouse/inventory-history
- POST http://localhost:5000/warehouse/rollback-stock

---

## What Works Now
✅ Shop pages (browsing, cart, basic orders)
✅ Admin product management
✅ Database connection
✅ Model relationships

## What Needs Implementation
❌ Authentication controllers
❌ Category controllers
❌ Payment controllers
❌ Warehouse controllers
❌ Email service
❌ PayPal integration

---

## Common Issues & Fixes

### Issue 1: Port 5000 already in use
```bash
# Find process using port 5000
netstat -aon | Select-String ':5000'

# Kill the process (replace PID with actual number)
taskkill /F /PID <PID>
```

### Issue 2: Database connection fails
Check your `.env` file:
```
DB_SCHEMA_NAME=book_store
DB_USER_NAME=postgres
DB_USER_PASSWORD=asdasd
DB_HOST_URL=localhost
DB_PORT=5433
PORT=5000
```

Verify PostgreSQL is running:
```bash
Get-Service -Name postgresql*
```

### Issue 3: Cannot resolve file errors in IDE
- These are warnings only
- The files exist in `routes/` folder
- The app will run correctly
- Restart IDE or rebuild index if needed

---

## Next Development Steps

### Priority 1: Authentication System
1. Check if `controllers/auth.js` exists
2. If not, create it with:
   - postRegister
   - postLogin
   - postLogout
   - postRequestUnlock
   - postVerifyUnlock
   - getCurrentUser

### Priority 2: Category Management
1. Check if `controllers/category.js` exists
2. If not, create with CRUD operations

### Priority 3: Payment Integration
1. Create PayPal developer account
2. Get API credentials
3. Add to `.env`:
   ```
   PAYPAL_CLIENT_ID=your_client_id
   PAYPAL_CLIENT_SECRET=your_secret
   PAYPAL_MODE=sandbox
   ```

---

## Testing Checklist

- [ ] Server starts without errors
- [ ] Can access homepage (/)
- [ ] Can view product list
- [ ] Can view product details
- [ ] Can add items to cart
- [ ] Database tables created
- [ ] Relationships working

---

## Need Help?

1. **Check logs**: Look at console output when starting server
2. **Check access.log**: View HTTP request logs
3. **Check documentation**: 
   - PROJECT_ANALYSIS_AND_ROADMAP.md
   - IMPLEMENTATION_PROGRESS.md
4. **Test database**: Run `node scripts/check-db.js`
5. **Test Sequelize**: Run `node scripts/check-sequelize.js`

---

## Environment Setup

Ensure your `.env` contains:
```env
# Database
DB_SCHEMA_NAME=book_store
DB_USER_NAME=postgres
DB_USER_PASSWORD=asdasd
DB_HOST_URL=localhost
DB_PORT=5433

# Server
PORT=5000

# Session (add these)
SESSION_SECRET=your-secret-key-change-this

# Email (add when ready)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# PayPal (add when ready)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
```

---

Ready to start! Run `npm install` then `npm start` 🚀

