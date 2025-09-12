import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  try {
    const { data: ver, error: verr } = await sb.from('checkins').select('id').limit(1);
    if (verr) return res.status(500).json({ ok: false, where: 'select checkins', error: verr.message });
    return res.status(200).json({ ok: true, rowsPreview: ver || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, where: 'createClient or network', error: e.message });
  }
}
