/** Tetapan portal. TUKAR `LINK_SECRET` dan kata laluan ejen sebelum guna sebenar (lihat DEPLOY-GUIDE.md). */
export const LINK_SECRET = '1052b5814d8d5250d24efef65b20337effc524ef88093620';
export const LINK_DAYS = 7;
export const SESSION_HOURS = 8;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export interface AgentAccount { email: string; name: string; salt: string; hash: string }
/** Hash = PBKDF2-SHA256, 100000 pusingan. Jana baharu: node scripts/hash-password.mjs <kata-laluan> */
export const AGENTS: AgentAccount[] = [
  { email: 'agent@generali-oneform.my', name: 'Ejen Generali', salt: '10cadd7c7cc0ce02', hash: 'ce26321f3f6f5ee459f7026f7f2d9da787a3c53a77d60092637952ffaea91986' }
];
