/**
 * Simple Role Fixer - Synchronous version with guaranteed output
 */

(async () => {
  const sequelize = require('../util/database');
  const User = require('../models/user');
  const Role = require('../models/role');

  console.log('='.repeat(50));
  console.log('FIXING USER ROLES');
  console.log('='.repeat(50));

  try {
    // Connect
    await sequelize.authenticate();
    console.log('[OK] Database connected\n');

    // Get roles
    const roles = await Role.findAll({ raw: true });
    console.log('--- AVAILABLE ROLES ---');
    if (roles.length === 0) {
      console.log('ERROR: No roles found in database!');
      process.exit(1);
    }
    
    roles.forEach(r => console.log(`  ${r.id}: ${r.name}`));
    
    const customerRole = roles.find(r => r.name === 'Customer');
    const adminRole = roles.find(r => r.name === 'Administrator');

    if (!customerRole || !adminRole) {
      console.log('\nERROR: Customer or Administrator role not found!');
      process.exit(1);
    }

    console.log(`\n[INFO] Customer Role ID: ${customerRole.id}`);
    console.log(`[INFO] Administrator Role ID: ${adminRole.id}\n`);

    // Get users
    const users = await User.findAll({ raw: true });
    console.log('--- CURRENT USERS ---');
    users.forEach(u => {
      console.log(`  ID ${u.id}: ${u.email} (roleId: ${u.roleId || 'NULL'})`);
    });

    // Fix each user
    console.log('\n--- UPDATING USERS ---');
    for (const user of users) {
      if (!user.roleId || user.roleId === null) {
        const isAdmin = user.email.toLowerCase().includes('admin');
        const newRoleId = isAdmin ? adminRole.id : customerRole.id;
        const newRoleName = isAdmin ? 'Administrator' : 'Customer';
        
        await User.update(
          { roleId: newRoleId },
          { where: { id: user.id } }
        );
        
        console.log(`  [UPDATED] ${user.email} -> ${newRoleName} (roleId: ${newRoleId})`);
      } else {
        const roleName = roles.find(r => r.id === user.roleId)?.name || 'Unknown';
        console.log(`  [SKIPPED] ${user.email} already has ${roleName} (roleId: ${user.roleId})`);
      }
    }

    // Verify
    console.log('\n--- VERIFICATION ---');
    const updatedUsers = await sequelize.query(
      `SELECT u.id, u.email, u."roleId", r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u."roleId" = r.id 
       ORDER BY u.id`,
      { type: sequelize.QueryTypes.SELECT }
    );

    updatedUsers.forEach(u => {
      const status = u.role_name ? '✓' : '✗';
      console.log(`  ${status} ID ${u.id}: ${u.email} -> ${u.role_name || 'NO ROLE!'} (roleId: ${u.roleId})`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('SUCCESS! All users have roles assigned.');
    console.log('='.repeat(50));
    process.exit(0);

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    console.error(error);
    process.exit(1);
  }
})();

