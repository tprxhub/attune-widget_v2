// /api/startOtp.js
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// minimal JSON body parser for Vercel Node functions
async function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Invalid JSON body')); }
      });
    } catch (e) { reject(e); }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) parse JSON body
    const { email, redirectTo } = await readJson(req);

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "email"' });
    }

    // 2) send OTP (6-digit code) using Supabase Auth
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo || process.env.DEFAULT_REDIRECT_URL || undefined,
        shouldCreateUser: true, // create if not exists
      },
    });

    if (error) {
      // bubble up the actual cause instead of generic 500
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('startOtp error:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
