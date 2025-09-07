// frontend/api/sbHealth.js
export default async function handler(req, res) {
  const envUrl = process.env.SUPABASE_URL || "";
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = {
    envUrl,
    hasKey,
    urlLooksValid: /^https:\/\/.*\.supabase\.co$/.test(envUrl),
  };

  try {
    if (!envUrl) throw new Error("SUPABASE_URL is not set");
    if (!envUrl.startsWith("https://")) throw new Error("SUPABASE_URL must start with https://");

    const r = await fetch(`${envUrl}/auth/v1/health`, { method: "GET" });
    result.status = r.status;
    result.ok = r.ok;
    return res.status(r.ok ? 200 : 502).json(result);
  } catch (e) {
    result.ok = false;
    result.error = e.message;

    // check generic outbound egress from Vercel
    try {
      const ping = await fetch("https://example.com", { method: "GET" });
      result.outboundWorks = ping.ok;
    } catch (e2) {
      result.outboundWorks = false;
      result.outboundError = e2.message;
    }

    return res.status(500).json(result);
  }
}
