require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../util/database');
const Role = require('../models/role');
const User = require('../models/user');
const Category = require('../models/category');

async function seedDatabase() {
  try {
    console.log('Starting database seed...');

    // Sync database (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('✓ Database synced');

    // Create Roles
    const roles = [
      { name: 'Customer', description: 'Regular customer with purchasing privileges' },
      { name: 'Administrator', description: 'Full system access and management' },
      { name: 'Warehouse', description: 'Inventory and order fulfillment management' },
      { name: 'Finance', description: 'Payment and financial reporting access' },
      { name: 'Delivery', description: 'Shipping and delivery management' }
    ];

    for (const roleData of roles) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData
      });
      if (created) {
        console.log(`✓ Created role: ${role.name}`);
      } else {
        console.log(`  Role already exists: ${role.name}`);
      }
    }

    // Create Admin User
    const adminRole = await Role.findOne({ where: { name: 'Administrator' } });
    const hashedPassword = await bcrypt.hash('admin123', 12);

    const [adminUser, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@bookstore.com' },
      defaults: {
        name: 'Admin User',
        email: 'admin@bookstore.com',
        password: hashedPassword,
        roleId: adminRole.id,
        emailVerified: true,
        loginAttempts: 0,
        isLocked: false
      }
    });

    if (adminCreated) {
      console.log('✓ Created admin user: admin@bookstore.com / admin123');
    } else {
      console.log('  Admin user already exists');
    }

    // Create Customer User
    const customerRole = await Role.findOne({ where: { name: 'Customer' } });
    const customerPassword = await bcrypt.hash('customer123', 12);

    const [customerUser, customerCreated] = await User.findOrCreate({
      where: { email: 'customer@bookstore.com' },
      defaults: {
        name: 'Test Customer',
        email: 'customer@bookstore.com',
        password: customerPassword,
        roleId: customerRole.id,
        emailVerified: true,
        loginAttempts: 0,
        isLocked: false
      }
    });

    if (customerCreated) {
      console.log('✓ Created customer user: customer@bookstore.com / customer123');
    } else {
      console.log('  Customer user already exists');
    }

    // Create Default Categories
    const categories = [
      { name: 'Fiction', description: 'Fictional novels and stories', slug: 'fiction' },
      { name: 'Non-Fiction', description: 'Educational and factual books', slug: 'non-fiction' },
      { name: 'Science', description: 'Science and technology books', slug: 'science' },
      { name: 'Technology', description: 'Programming and IT books', slug: 'technology' },
      { name: 'Business', description: 'Business and entrepreneurship', slug: 'business' }
    ];

    for (const catData of categories) {
      const [category, created] = await Category.findOrCreate({
        where: { name: catData.name },
        defaults: catData
      });
      if (created) {
        console.log(`✓ Created category: ${category.name}`);
      } else {
        console.log(`  Category already exists: ${category.name}`);
      }
    }

    console.log('\n==============================================');
    console.log('Database seeding completed successfully!');
    console.log('==============================================');
    console.log('\nTest Accounts:');
    console.log('  Admin:    admin@bookstore.com / admin123');
    console.log('  Customer: customer@bookstore.com / customer123');
    console.log('\nRoles created: 5');
    console.log('Categories created: 5');
    console.log('==============================================\n');

    process.exit(0);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();

