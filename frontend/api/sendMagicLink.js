import { createClient } from '@supabase/supabase-js';

const supabaseServer = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, redirectTo } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const { error } = await supabaseServer.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('sendMagicLink error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
