const path = require("path");
const adminController = require("../controllers/admin");
const userController = require("../controllers/user");

const express = require("express");

const router = express.Router();

// Product Management Routes
// /admin/add-product => GET
router.get("/add-product", adminController.getAddProduct);

// /admin/add-product => POST
router.post("/add-product", adminController.postAddProduct);

// /admin/edit-product => GET
router.get("/edit-product/:productId", adminController.getEditProduct);

// /admin/edit-product => POST
router.post("/edit-product", adminController.postEditProduct);

// /admin/product-list => GET
router.get("/product-list", adminController.getProducts);

// /admin/delete-product => POST
router.post("/delete-product", adminController.deleteProduct);

// Orders
// /admin/orders => GET (optional ?status=)
router.get('/orders', adminController.getOrders);

// User Management Routes
// /admin/users => GET - List all users
router.get("/users", userController.getUsers);

// /admin/users/:id/edit => GET - Edit user form
router.get("/users/:id/edit", userController.getEditUser);

// /admin/users/:id/update-role => POST - Update user role
router.post("/users/:id/update-role", userController.postUpdateUserRole);

// /admin/users/:id/lock => POST - Lock/unlock user
router.post("/users/:id/lock", userController.postToggleUserLock);

// /admin/users/:id => DELETE - Delete user
router.delete("/users/:id", userController.deleteUser);

module.exports = router;
