const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user');
const Role = require('../models/role');

/**
 * POST /auth/register
 * Register a new user
 */
exports.postRegister = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Get default Customer role
    let customerRole = await Role.findOne({ where: { name: 'Customer' } });
    if (!customerRole) {
      // Create default roles if they don't exist
      customerRole = await Role.create({
        name: 'Customer',
        description: 'Regular customer with purchasing privileges'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      roleId: customerRole.id,
      emailVerified: false,
      verificationToken,
      loginAttempts: 0,
      isLocked: false
    });

    // TODO: Send verification email
    // await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
      verificationRequired: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * POST /auth/login
 * User login with account lockout after 3 failed attempts
 */
exports.postLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user with role
    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
        return res.status(423).json({
          error: `Account is locked. Try again in ${minutesLeft} minutes or request unlock code.`,
          locked: true,
          lockedUntil: user.lockedUntil
        });
      } else {
        // Lock expired, reset
        user.isLocked = false;
        user.lockedUntil = null;
        user.loginAttempts = 0;
        await user.save();
      }
    }

    // Check email verification (optional - can be disabled for development)
    // if (!user.emailVerified) {
    //   return res.status(403).json({
    //     error: 'Please verify your email before logging in',
    //     emailVerified: false
    //   });
    // }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Increment login attempts
      user.loginAttempts += 1;

      // Lock account after 3 failed attempts
      if (user.loginAttempts >= 3) {
        user.isLocked = true;
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await user.save();

        // TODO: Send unlock code email
        // await sendUnlockEmail(user.email);

        return res.status(423).json({
          error: 'Account locked due to too many failed login attempts. Check your email for unlock instructions.',
          locked: true,
          lockedUntil: user.lockedUntil
        });
      }

      await user.save();

      return res.status(401).json({
        error: `Invalid email or password. ${3 - user.loginAttempts} attempts remaining.`,
        attemptsRemaining: 3 - user.loginAttempts
      });
    }

    // Successful login - reset attempts
    user.loginAttempts = 0;
    user.lastLoginAt = new Date();
    await user.save();

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;
    req.session.userRole = user.role ? user.role.name : 'Customer';

    // Determine redirect URL based on role
    let redirectUrl = '/customer/dashboard';
    if (user.role) {
      switch (user.role.name) {
        case 'Administrator':
          redirectUrl = '/admin/dashboard';
          break;
        case 'Warehouse':
          redirectUrl = '/warehouse/dashboard';
          break;
        case 'Finance':
          redirectUrl = '/payment/dashboard';
          break;
        case 'Delivery':
          redirectUrl = '/warehouse/dashboard';
          break;
        case 'Customer':
        default:
          redirectUrl = '/customer/dashboard';
      }
    }

    res.status(200).json({
      message: 'Login successful',
      redirectUrl: redirectUrl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role ? user.role.name : 'Customer'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * POST /auth/logout
 * User logout
 */
exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.status(200).json({
      message: 'Logout successful',
      redirectUrl: '/' // Redirect to welcome page
    });
  });
};

/**
 * POST /auth/request-unlock
 * Request account unlock code
 */
exports.postRequestUnlock = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({
        message: 'If the email exists, an unlock code has been sent.'
      });
    }

    if (!user.isLocked) {
      return res.status(400).json({
        error: 'Account is not locked'
      });
    }

    // Generate unlock code
    const unlockCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    user.verificationToken = unlockCode;
    await user.save();

    // TODO: Send unlock code email
    // await sendUnlockEmail(user.email, unlockCode);

    console.log(`Unlock code for ${email}: ${unlockCode}`); // For development

    res.status(200).json({
      message: 'Unlock code sent to your email',
      // Remove this in production:
      devCode: unlockCode
    });

  } catch (error) {
    console.error('Request unlock error:', error);
    res.status(500).json({ error: 'Failed to process unlock request' });
  }
};

/**
 * POST /auth/verify-unlock
 * Verify unlock code and unlock account
 */
exports.postVerifyUnlock = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'Email and unlock code are required'
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user || user.verificationToken !== code.toUpperCase()) {
      return res.status(400).json({
        error: 'Invalid unlock code'
      });
    }

    // Unlock account
    user.isLocked = false;
    user.lockedUntil = null;
    user.loginAttempts = 0;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({
      message: 'Account unlocked successfully. You can now login.'
    });

  } catch (error) {
    console.error('Verify unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
};

/**
 * GET /auth/me
 * Get current user info (protected route)
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    const user = await User.findByPk(req.session.userId, {
      include: [{ model: Role, as: 'role' }],
      attributes: { exclude: ['password', 'verificationToken', 'resetPasswordToken'] }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role ? user.role.name : 'Customer',
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

