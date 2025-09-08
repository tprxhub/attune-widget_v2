import { createClient } from '@supabase/supabase-js';

const sbAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  // Who is making this request?
  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const user_id = userData.user.id;

  const {
    child_email,
    child_name = null,
    goal = null,
    activity = null,
    completion_score = null,
    mood_score = null,
    sleep_hours = null,
    notes = null,
    checkin_date = null, // optional; if not sent, DB default current_date is used
  } = req.body || {};

  if (!child_email) return res.status(400).json({ error: 'child_email is required' });

  // Basic sanity checks
  const c = Number(completion_score);
  const m = Number(mood_score);
  if (completion_score != null && (Number.isNaN(c) || c < 1 || c > 5))
    return res.status(400).json({ error: 'completion_score must be 1–5' });
  if (mood_score != null && (Number.isNaN(m) || m < 1 || m > 5))
    return res.status(400).json({ error: 'mood_score must be 1–5' });

  const insert = {
    user_id,
    child_email,
    child_name,
    goal,
    activity,
    completion_score: completion_score == null ? null : c,
    mood_score:       mood_score == null ? null : m,
    sleep_hours:      sleep_hours == null ? null : Number(sleep_hours),
    notes,
    ...(checkin_date ? { checkin_date } : {}), // e.g. '2025-09-08'
  };

  const { data, error } = await sbAdmin
    .from('checkins')
    .insert(insert)
    .select('id, created_at');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, id: data?.[0]?.id, created_at: data?.[0]?.created_at });
}
