import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });

async function readJson(req){ return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ if(!raw) return resolve({}); try{ resolve(JSON.parse(raw)); }catch{ reject(new Error('Invalid JSON body')); } }); }); }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); return res.status(204).end(); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = await readJson(req);
    const { child_name, child_email, goal, activity, completion_score, mood_score, sleep_hours=null, notes=null, checkin_date=null } = b || {};
    if (!child_name || !child_email || !goal || !activity) return res.status(400).json({ error:'Missing required fields' });

    const comp = Number(completion_score), mood = Number(mood_score);
    if (!Number.isFinite(comp) || comp<1 || comp>5) return res.status(400).json({ error:'completion_score must be 1–5' });
    if (!Number.isFinite(mood) || mood<1 || mood>5) return res.status(400).json({ error:'mood_score must be 1–5' });

    const row = {
      // user_id omitted on purpose for public mode
      child_name, child_email, goal, activity,
      completion_score: comp, mood_score: mood,
      sleep_hours, notes,
      checkin_date: checkin_date || new Date().toISOString().slice(0,10)
    };

    const { data, error } = await sb.from('checkins').insert([row]).select('id').single();
    if (error) return res.status(500).json({ error: error.message });

    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('x-mode', 'public');
    return res.status(200).json({ ok:true, id:data?.id || null, mode:'public' });
  } catch (e) {
    console.error('saveCheckins fatal:', e);
    return res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
