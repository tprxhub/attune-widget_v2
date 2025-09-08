import { createClient } from '@supabase/supabase-js';

const sbAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Query params:
 *   ?child_email=...   (required to scope the graph per child)
 *   ?since=YYYY-MM-DD  (optional)
 *   ?until=YYYY-MM-DD  (optional)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const user_id = userData.user.id;

  const child_email = req.query.child_email || req.query.childEmail;
  if (!child_email) return res.status(400).json({ error: 'child_email is required' });

  const since = req.query.since || null;
  const until = req.query.until || null;

  let q = sbAdmin
    .from('checkins')
    .select(
      'id, created_at, checkin_date, child_email, child_name, goal, activity, completion_score, mood_score, sleep_hours, notes'
    )
    .eq('user_id', user_id)
    .eq('child_email', child_email)
    .order('checkin_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (since) q = q.gte('checkin_date', since);
  if (until) q = q.lte('checkin_date', until);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    rows: data || [],
    count: data?.length || 0
  });
}
