import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON body')); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ error:'Method not allowed' }); }
  try {
    const { email, redirectTo } = await readJson(req);
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Missing or invalid "email"' });

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        // if you only use 6-digit codes, you can omit redirectTo
        emailRedirectTo: redirectTo || process.env.DEFAULT_REDIRECT_URL || undefined,
        shouldCreateUser: true,
      },
    });

    if (error) {
      const msg = String(error.message || '');
      // surface rate limit distinctly
      if (msg.toLowerCase().includes('rate limit')) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: msg });
      }
      // 400 for all known “send” failures so you can see the exact message
      return res.status(400).json({ error: msg || 'Failed to send OTP' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('startOtp fatal:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
