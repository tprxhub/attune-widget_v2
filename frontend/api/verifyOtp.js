// /api/verifyOtp.js
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid JSON body')); }
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
    const { email, token } = await readJson(req);
    if (!email || !token) {
      return res.status(400).json({ error: 'Missing email or token' });
    }

    const { data, error } = await sb.auth.verifyOtp({
      email,
      token,
      type: 'email', // 6-digit email OTP
    });

    if (error) return res.status(400).json({ error: error.message });

    // hand back an access token so the frontend can store it
    return res.status(200).json({
      access_token: data?.session?.access_token || null,
      expires_in: data?.session?.expires_in || 3600,
      user: data?.user || null,
    });
  } catch (e) {
    console.error('verifyOtp error:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
