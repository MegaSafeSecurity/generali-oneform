'use strict';
module.exports = function createStore(env = process.env) {
  const configured = env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY;
  if (configured) return require('./supabase.js')(env);
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO !== '1') {
    throw new Error('Production needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY. Refusing to start in demo (in-memory) mode.');
  }
  return require('./memory.js')(env);
};
