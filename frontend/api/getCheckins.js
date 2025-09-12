import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const child_email = req.query.child_email || req.query.childEmail;
    if (!child_email) return res.status(400).json({ error: 'child_email is required' });

    const since = req.query.since || null;
    const until = req.query.until || null;
    const goal  = req.query.goal  || null;

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    const doPublic = !token && process.env.ALLOW_PUBLIC_PROGRESS === 'true';

    let q = sb.from('checkins')
      .select('id, created_at, checkin_date, child_email, child_name, goal, activity, completion_score, mood_score, sleep_hours, notes')
      .eq('child_email', child_email)
      .order('checkin_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (!doPublic) {
      if (!token) return res.status(401).json({ error: 'Missing bearer token' });
      const { data: u, error: uerr } = await sb.auth.getUser(token);
      if (uerr || !u?.user) return res.status(401).json({ error: uerr?.message || 'Invalid token' });
      q = q.eq('user_id', u.user.id);
    }

    if (goal)  q = q.eq('goal', goal);
    if (since) q = q.gte('checkin_date', since);
    if (until) q = q.lte('checkin_date', until);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ rows: data || [], mode: doPublic ? 'public' : 'auth' });
  } catch (e) {
    console.error('getCheckins fatal:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
