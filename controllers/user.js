const User = require('../models/user');
const Role = require('../models/role');

/**
 * Admin User Management Controller
 * Allows admins to view and manage users and their roles
 */

/**
 * GET /admin/users
 * Display all users with their roles
 */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{
        model: Role,
        as: 'role',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'emailVerified', 'isLocked', 'createdAt', 'lastLoginAt']
    });

    res.render('admin/users', {
      pageTitle: 'User Management',
      path: '/admin/users',
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).render('500', { error: 'Failed to load users' });
  }
};

/**
 * GET /admin/users/:id/edit
 * Show edit user form (including role assignment)
 */
exports.getEditUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByPk(userId, {
      include: [{
        model: Role,
        as: 'role',
        attributes: ['id', 'name']
      }]
    });

    if (!user) {
      return res.status(404).render('404', { pageTitle: 'User Not Found' });
    }

    // Get all available roles
    const roles = await Role.findAll({
      order: [['name', 'ASC']]
    });

    res.render('admin/edit-user', {
      pageTitle: 'Edit User',
      path: '/admin/users',
      user,
      roles
    });
  } catch (error) {
    console.error('Get edit user error:', error);
    res.status(500).render('500', { error: 'Failed to load user' });
  }
};

/**
 * POST /admin/users/:id/update-role
 * Update user's role
 */
exports.postUpdateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from changing their own role
    if (user.id === req.user.id) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    // Verify role exists
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Update user's role
    user.roleId = roleId;
    await user.save();

    res.status(200).json({
      message: `User role updated to ${role.name}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role.name
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

/**
 * POST /admin/users/:id/lock
 * Lock/unlock user account
 */
exports.postToggleUserLock = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from locking themselves
    if (user.id === req.user.id) {
      return res.status(403).json({ error: 'You cannot lock your own account' });
    }

    // Toggle lock status
    if (user.isLocked) {
      user.isLocked = false;
      user.lockedUntil = null;
      user.loginAttempts = 0;
    } else {
      user.isLocked = true;
      user.lockedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    }

    await user.save();

    res.status(200).json({
      message: user.isLocked ? 'User account locked' : 'User account unlocked',
      isLocked: user.isLocked
    });
  } catch (error) {
    console.error('Toggle user lock error:', error);
    res.status(500).json({ error: 'Failed to update user lock status' });
  }
};

/**
 * DELETE /admin/users/:id
 * Soft delete user (mark as inactive)
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    // Soft delete - just lock the account permanently
    user.isLocked = true;
    user.lockedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years
    await user.save();

    res.status(200).json({
      message: 'User account deleted (locked)',
      userId: user.id
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * GET /api/roles
 * Get all available roles for assignment
 */
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']]
    });

    res.status(200).json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

