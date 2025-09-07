import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    // Sends a 6-digit code email; no redirect needed
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('startOtp error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
