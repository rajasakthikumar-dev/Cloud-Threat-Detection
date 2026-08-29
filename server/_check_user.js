require('dotenv').config();
const { findUserByEmail } = require('./config/firebase');

async function check() {
  const user = await findUserByEmail('r@gmail.com');
  if (user) {
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Name:', user.name);
    console.log('  Has password hash:', !!user.passwordHash);
  } else {
    console.log('User not found');
  }
  process.exit(0);
}

check();
