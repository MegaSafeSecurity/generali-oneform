import { pbkdf2Sync, randomBytes } from 'node:crypto';
const pw = process.argv[2]; if (!pw) { console.error('Guna: node scripts/hash-password.mjs <kata-laluan>'); process.exit(1); }
const salt = randomBytes(8).toString('hex');
console.log(JSON.stringify({ salt, hash: pbkdf2Sync(pw, salt, 100000, 32, 'sha256').toString('hex') }, null, 2));
