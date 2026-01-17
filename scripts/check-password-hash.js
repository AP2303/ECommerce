const sequelize = require('../util/database');
const User = require('../models/user');

function looksLikeBcryptHash(pw) {
  return typeof pw === 'string' && pw.startsWith('$2') && pw.length >= 60;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    const users = await User.findAll({ attributes: ['id','email','password'], raw: true });
    if (!users || users.length === 0) {
      console.log('No users found');
      process.exit(0);
    }
    console.log(`Found ${users.length} users:`);
    for (const u of users) {
      const hashed = looksLikeBcryptHash(u.password);
      console.log(`ID: ${u.id} | ${u.email} | password present: ${u.password ? 'yes' : 'no'} | bcrypt-hash-like: ${hashed}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error', err.message || err);
    process.exit(1);
  }
})();
