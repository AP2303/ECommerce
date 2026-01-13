const express = require("express");
const router = express.Router();
const warehouseController = require("../controllers/warehouse");

/**
 * Warehouse/Inventory Routes
 * Accessible by Admin and Warehouse roles
 */

// GET /warehouse/inventory - Get inventory list
router.get("/inventory", warehouseController.getInventory);

// POST /warehouse/stock - Update product stock
router.post("/stock", warehouseController.postUpdateStock);

// GET /warehouse/orders-to-pack - Get orders ready for packing
router.get("/orders-to-pack", warehouseController.getOrdersToPack);

// POST /warehouse/pack-order/:orderId - Mark order as packed
router.post("/pack-order/:orderId", warehouseController.postPackOrder);

// GET /warehouse/inventory-history - Get inventory change history
router.get("/inventory-history", warehouseController.getInventoryHistory);

// POST /warehouse/rollback-stock - Rollback stock for cancelled order
router.post("/rollback-stock", warehouseController.postRollbackStock);

module.exports = router;

