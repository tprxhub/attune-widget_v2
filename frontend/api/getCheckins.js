// frontend/api/getCheckins.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // 2) Optional filter by child_email
    const { child_email } = req.query;

    let query = supabaseAdmin
      .from('checkins')
      .select('*')
      .eq('parent_id', parentId)
      .order('checkin_date', { ascending: true });

    if (child_email) query = query.eq('child_email', child_email);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ rows: data || [] });
  } catch (err) {
    console.error('getCheckins error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
