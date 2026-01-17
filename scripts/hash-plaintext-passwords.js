const sequelize = require('../util/database');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const fs = require('fs');

function looksLikeBcryptHash(pw) {
  return typeof pw === 'string' && pw.startsWith('$2') && pw.length >= 60;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const users = await User.findAll({ raw: true });
    console.log(`Found ${users.length} users`);

    const toUpdate = [];

    for (const u of users) {
      const pw = u.password;
      if (!pw || pw === '') {
        // Skip users without password (maybe OAuth)
        continue;
      }
      if (!looksLikeBcryptHash(pw)) {
        toUpdate.push({ id: u.id, email: u.email, currentPassword: pw });
      }
    }

    if (toUpdate.length === 0) {
      console.log('No plaintext passwords found. Nothing to do.');
      process.exit(0);
    }

    console.log(`Found ${toUpdate.length} users with non-bcrypt passwords. Hashing now...`);

    const results = [];
    for (const item of toUpdate) {
      const newHash = await bcrypt.hash(String(item.currentPassword), 12);
      await User.update({ password: newHash }, { where: { id: item.id } });
      results.push({ id: item.id, email: item.email });
      console.log(`Hashed password for user id=${item.id} email=${item.email}`);
    }

    // Write audit file
    const auditPath = 'scripts/hashed-passwords-backup.json';
    fs.writeFileSync(auditPath, JSON.stringify({ timestamp: new Date().toISOString(), updated: results }, null, 2));
    console.log(`Wrote audit file: ${auditPath}`);

    console.log('Done. Please restart the server and test login for affected users.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();

