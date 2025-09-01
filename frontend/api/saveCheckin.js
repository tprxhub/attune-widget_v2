// frontend/api/saveCheckins.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Verify Supabase auth token from client
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const parentId = userData.user.id;

    // 2) Parse and validate body
    const { child_email, mood, sleep_hours, energy } = req.body || {};
    if (!child_email) return res.status(400).json({ error: 'child_email is required' });

    const m = Number(mood);
    const s = Number(sleep_hours);
    const e = Number(energy);

    if (!Number.isFinite(m) || m < 1 || m > 5) {
      return res.status(400).json({ error: 'mood must be an integer 1–5' });
    }
    if (!Number.isFinite(s) || s < 0 || s > 24) {
      return res.status(400).json({ error: 'sleep_hours must be 0–24' });
    }
    if (!Number.isFinite(e) || e < 1 || e > 10) {
      return res.status(400).json({ error: 'energy must be an integer 1–10' });
    }

    // 3) Insert (RLS will also protect, but we set parent_id explicitly)
    const { data, error } = await supabaseAdmin
      .from('checkins')
      .insert([{ child_email, mood: m, sleep_hours: s, energy: e, parent_id: parentId }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, checkin: data });
  } catch (err) {
    console.error('saveCheckins error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
