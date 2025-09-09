export const API_ROOT = process.env.REACT_APP_API_URL || "/api";

export async function getBearer() {
  try {
    const t = localStorage.getItem("sb_access_token");
    const exp = Number(localStorage.getItem("sb_access_token_exp") || 0);
    if (t && Date.now() < exp) return t;
  } catch {}
  try {
    if (typeof supabase !== "undefined" && supabase?.auth) {
      const { data: { session } = {} } = await supabase.auth.getSession();
      return session?.access_token || null;
    }
  } catch {}
  return null;
}

export async function apiGet(path) {
  const token = await getBearer();
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : {};
}

export async function apiPost(path, body) {
  const token = await getBearer();
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : {};
}
