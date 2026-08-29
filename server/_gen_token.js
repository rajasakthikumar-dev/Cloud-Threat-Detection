/**
 * Generates a test JWT signed with the server's JWT_SECRET.
 * Used only for integration testing — not a production file.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
if (!secret) { console.error('JWT_SECRET not set'); process.exit(1); }

const token = jwt.sign(
  { id: 'test-user-001', email: 'test@integration.local', role: 'user' },
  secret,
  { expiresIn: '1h' }
);

console.log(token);
