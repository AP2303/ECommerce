/**
 * Fix User Roles Script
 * Assigns proper roles to all users in the database
 */

const sequelize = require('../util/database');
const User = require('../models/user');
const Role = require('../models/role');

async function fixUserRoles() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Get all roles
    const roles = await Role.findAll();
    console.log('\n=== Available Roles ===');
    roles.forEach(role => {
      console.log(`ID: ${role.id} | Name: ${role.name}`);
    });

    // Find roles by name
    const customerRole = roles.find(r => r.name === 'Customer');
    const adminRole = roles.find(r => r.name === 'Administrator');

    if (!customerRole || !adminRole) {
      console.error('ERROR: Required roles not found!');
      console.log('Creating missing roles...');

      if (!customerRole) {
        await Role.create({ name: 'Customer', description: 'Regular customer' });
      }
      if (!adminRole) {
        await Role.create({ name: 'Administrator', description: 'Admin user' });
      }

      return fixUserRoles(); // Retry after creating roles
    }

    console.log(`\nCustomer Role ID: ${customerRole.id}`);
    console.log(`Administrator Role ID: ${adminRole.id}`);

    // Get all users
    const users = await User.findAll({
      include: [{ model: Role, as: 'role' }]
    });

    console.log('\n=== Current Users ===');
    users.forEach(user => {
      console.log(`ID: ${user.id} | Email: ${user.email} | RoleId: ${user.roleId} | Role: ${user.role ? user.role.name : 'NULL'}`);
    });

    // Fix users without roles
    console.log('\n=== Fixing User Roles ===');

    for (const user of users) {
      if (!user.roleId) {
        // Assign role based on email
        if (user.email.includes('admin')) {
          user.roleId = adminRole.id;
          await user.save();
          console.log(`✓ Assigned Administrator role to ${user.email}`);
        } else {
          user.roleId = customerRole.id;
          await user.save();
          console.log(`✓ Assigned Customer role to ${user.email}`);
        }
      } else {
        console.log(`- ${user.email} already has role (ID: ${user.roleId})`);
      }
    }

    // Verify the changes
    console.log('\n=== Updated Users ===');
    const updatedUsers = await User.findAll({
      include: [{ model: Role, as: 'role' }]
    });

    updatedUsers.forEach(user => {
      console.log(`ID: ${user.id} | Email: ${user.email} | RoleId: ${user.roleId} | Role: ${user.role ? user.role.name : 'NULL'}`);
    });

    console.log('\n✓ User roles fixed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error fixing user roles:', error);
    process.exit(1);
  }
}

fixUserRoles();

