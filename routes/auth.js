const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");

/**
 * Authentication Routes
 */

// POST /auth/register - User registration
router.post("/register", authController.postRegister);

// POST /auth/login - User login
router.post("/login", authController.postLogin);

// POST /auth/logout - User logout
router.post("/logout", authController.postLogout);

// POST /auth/request-unlock - Request account unlock code
router.post("/request-unlock", authController.postRequestUnlock);

// POST /auth/verify-unlock - Verify unlock code and unlock account
router.post("/verify-unlock", authController.postVerifyUnlock);

// GET /auth/me - Get current user
router.get("/me", authController.getCurrentUser);

module.exports = router;

