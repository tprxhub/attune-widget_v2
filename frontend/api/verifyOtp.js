import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, token } = req.body || {};
  if (!email || !token) return res.status(400).json({ error: 'email and token are required' });

  try {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return res.status(401).json({ error: error.message });

    const access_token = data?.session?.access_token;
    const expires_in = data?.session?.expires_in ?? 3600;
    if (!access_token) return res.status(500).json({ error: 'No access token from verify' });

    // Return token to the browser (it will be used only to call YOUR /api/*)
    return res.status(200).json({ access_token, expires_in });
  } catch (e) {
    console.error('verifyOtp error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
