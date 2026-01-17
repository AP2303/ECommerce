const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category");

/**
 * Category Routes
 */

// GET /categories - Get all active categories (public)
router.get("/", categoryController.getAllPublic);

// GET /categories/:id - Get single category with products (public)
router.get("/:id", categoryController.getCategory);

// POST /categories - Create category (Admin only)
router.post("/", categoryController.postCreateCategory);

// PUT /categories/:id - Update category (Admin only)
router.put("/:id", categoryController.putUpdateCategory);

// DELETE /categories/:id - Delete category (Admin only)
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
