export default async function handler(req, res) {
  try {
    const url = `${process.env.SUPABASE_URL}/auth/v1/health`;
    const r = await fetch(url, { method: 'GET' });
    return res.status(r.status).json({ ok: r.ok });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
