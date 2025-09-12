export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    now: new Date().toISOString(),
    env: {
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ALLOW_PUBLIC_PROGRESS: process.env.ALLOW_PUBLIC_PROGRESS || null,
      ALLOW_PUBLIC_CHECKINS: process.env.ALLOW_PUBLIC_CHECKINS || null,
    },
  });
}
