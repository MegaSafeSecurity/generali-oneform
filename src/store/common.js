'use strict';
const crypto = require('node:crypto');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const newReference = () => `GEN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const TYPES = ['PI', 'PL', 'GPA'];
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);
const KEY = /^[A-Za-z0-9_]{1,60}$/;
function cleanMap(o, what) {
  if (!isPlain(o) || Object.keys(o).length > 200) throw Object.assign(new Error(`Invalid ${what}.`), { status: 400 });
  for (const [k, v] of Object.entries(o)) {
    if (!KEY.test(k) || !(typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && v.length <= 5000))) throw Object.assign(new Error(`Invalid ${what}.`), { status: 400 });
  }
  return o;
}
/** Validates and returns only the expected shape of a customer submission. */
function cleanSubmission(b) {
  if (!isPlain(b)) throw Object.assign(new Error('Invalid request.'), { status: 400 });
  const answers = cleanMap(b.answers, 'answers');
  const members = b.members === undefined ? [] : b.members;
  if (!Array.isArray(members) || members.length > 200) throw Object.assign(new Error('Invalid members.'), { status: 400 });
  members.forEach((m) => cleanMap(m, 'members'));
  const img = (v, types, max, required, name) => {
    if (!v) { if (required) throw Object.assign(new Error(`${name} is required.`), { status: 400 }); return null; }
    const m = typeof v === 'string' && v.match(new RegExp(`^data:image/(${types});base64,([A-Za-z0-9+/=]+)$`));
    if (!m || v.length > max) throw Object.assign(new Error(`Invalid ${name}.`), { status: 400 });
    return { mime: 'image/' + m[1], buffer: Buffer.from(m[2], 'base64') };
  };
  return { answers, members, signature: img(b.signatureData, 'png', 2e6, true, 'signature'), stamp: img(b.stampData, 'png|jpeg', 4e6, false, 'stamp') };
}
module.exports = { sha256, newToken, newReference, TYPES, cleanSubmission };
