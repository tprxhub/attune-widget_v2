import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const child_email = req.query.child_email || req.query.childEmail;
  if (!child_email) return res.status(400).json({ error: 'child_email is required' });

  try {
    let q = sb.from('checkins')
      .select('id, created_at, checkin_date, child_email, child_name, goal, activity, completion_score, mood_score, sleep_hours, notes')
      .eq('child_email', child_email)
      .order('checkin_date', { ascending: true })
      .order('created_at', { ascending: true });

    // optional filters
    if (req.query.goal)  q = q.eq('goal', req.query.goal);
    if (req.query.since) q = q.gte('checkin_date', req.query.since);
    if (req.query.until) q = q.lte('checkin_date', req.query.until);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // debug header to prove public path
    res.setHeader('x-mode', 'public');
    return res.status(200).json({ rows: data || [], mode: 'public' });
  } catch (e) {
    console.error('getCheckins fatal:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
