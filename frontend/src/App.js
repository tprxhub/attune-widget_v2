// frontend/src/App.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Line as LineChart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
import "./App.css";

/* ========== GOOGLE FORM CONFIG — SET THESE ========== */

//    Or set REACT_APP_GOOGLE_FORM_URL in Vercel and leave this as fallback.
const GOOGLE_FORM_URL =
  process.env.REACT_APP_GOOGLE_FORM_URL ||
      "https://docs.google.com/forms/d/e/1FAIpQLSdafXjeB2ZX8bnyYzcsu7LiB0G-6cKxaL0LD7cAjTRlV9WAhA/viewform?embedded=true";

// 2) The entry key for your Email field in the Form (e.g., "entry.1234567890").
//    Find it via Form → ⋮ → Get pre-filled link → type a test email → Get link → copy URL → look for entry.########=...
const GOOGLE_FORM_EMAIL_ENTRY = "entry.1860338265"; 

// --- URL tab helpers ---
const VALID_TABS = new Set(["assistant", "checkin", "progress"]);

function getTabFromURL() {
  try {
    const q = new URLSearchParams(window.location.search);
    const t = (q.get("tab") || "").toLowerCase();
    return VALID_TABS.has(t) ? t : "checkin";
  } catch {
    return "checkin";
  }
}

function setTabInURL(tab) {
  try {
    const q = new URLSearchParams(window.location.search);
    q.set("tab", tab);
    const url = window.location.pathname + "?" + q.toString();
    window.history.replaceState(null, "", url);
  } catch {}
}

/* =========================
   Shared helpers
========================= */
function normalizeBullets(s = "") {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/(^|\n)\s*(\d+)\.\s*\n+/g, "$1$2. ")
    .replace(/(^|\n)\s*([-*•])\s*\n+/g, "$1$2 ");
}
const API_BASE = process.env.REACT_APP_BACKEND_URL || "/api"; // for your assistant only
const API_ROOT = process.env.REACT_APP_API_URL || "/api";     // for your check-in APIs

const stripCitations = (text = "") => text.replace(/【[^】]*】/g, "");
const fixInlineEnumerations = (t = "") =>
  t.replace(/(\S) ([0-9]+)\.\s/g, (_, prev, num) => `${prev} ${num}) `);
const renderText = (t = "") => fixInlineEnumerations(stripCitations(normalizeBullets(t)));

function getChildEmailFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("email") || "";
  } catch {
    return "";
  }
}

/* =========================================
   Token capture & API client (no SDK calls)
========================================= */
function getStoredToken() {
  try {
    const t = localStorage.getItem("sb_access_token");
    const exp = Number(localStorage.getItem("sb_access_token_exp") || 0);
    if (!t || Date.now() > exp) return null;
    return t;
  } catch {
    return null;
  }
}
function captureTokenFromHash() {
  const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return false;
  const p = new URLSearchParams(hash);
  const access = p.get("access_token");
  const type = (p.get("token_type") || "").toLowerCase();
  const expiresIn = parseInt(p.get("expires_in") || "3600", 10);
  if (access && (!type || type === "bearer")) {
    const expAt = Date.now() + expiresIn * 1000;
    localStorage.setItem("sb_access_token", access);
    localStorage.setItem("sb_access_token_exp", String(expAt));
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  }
  return false;
}
function clearToken() {
  localStorage.removeItem("sb_access_token");
  localStorage.removeItem("sb_access_token_exp");
}

async function apiGet(path) {
  const token = getStoredToken();
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const token = getStoredToken();
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* =========================
   Assistant UI (unchanged)
========================= */
function AssistantView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    setError("");
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ask-attune`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || `Request failed: ${response.status}`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: normalizeBullets(data.reply) },
      ]);
    } catch (err) {
      console.error(err);
      setError("Sorry — something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h1>
        Troubleshoot with Attune<span className="tm">™</span> by ToyRx
      </h1>

      <div className="chat-box" ref={boxRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`bubble ${msg.role}`}>
            <ReactMarkdown
              components={{
                li: ({ node, ...props }) => <li style={{ fontWeight: 400 }} {...props} />,
                p: ({ node, ...props }) => <p style={{ margin: "4px 0" }} {...props} />,
                ul: ({ node, ...props }) => (
                  <ul style={{ margin: "4px 0", paddingLeft: "1.1rem" }} {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol style={{ margin: "4px 0", paddingLeft: "1.1rem" }} {...props} />
                ),
              }}
            >
              {renderText(msg.content)}
            </ReactMarkdown>
          </div>
        ))}

        {loading && <div className="bubble assistant">Attune is thinking...</div>}
        {error && <div className="bubble assistant">{error}</div>}
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your question here..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}

/* =========================
   Login (OTP via your API)
========================= */
function EmailLogin() {
  const [step, setStep] = useState("email"); // 'email' | 'code'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_ROOT}/startOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send code");
      setStep("code");
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_ROOT}/verifyOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.access_token) throw new Error(json.error || "Invalid code");

      const expAt = Date.now() + (json.expires_in || 3600) * 1000;
      localStorage.setItem("sb_access_token", json.access_token);
      localStorage.setItem("sb_access_token_exp", String(expAt));
      // notify app to update state
      window.dispatchEvent(new StorageEvent("storage", { key: "sb_access_token" }));
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return step === "email" ? (
    <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
      {err && <div className="bubble assistant">{err}</div>}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Sending..." : "Send code"}
      </button>
    </form>
  ) : (
    <form onSubmit={verify} style={{ display: "grid", gap: 12 }}>
      {err && <div className="bubble assistant">{err}</div>}
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter 6-digit code"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Verifying..." : "Verify"}
      </button>
    </form>
  );
}

/* =========================
   Check-In Form (exact Google Form)
========================= */
function CheckinFormView() {
  // Get ?email or ?name from the URL (Tevello can pass either)
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const childValue = search.get("email") || search.get("name") || "";

  const formSrc = useMemo(() => {
    try {
      const u = new URL(GOOGLE_FORM_URL);
      if (GOOGLE_FORM_TARGET_ENTRY && childValue) {
        u.searchParams.set(GOOGLE_FORM_TARGET_ENTRY, childValue);
      }
      // Google likes having this flag present for prefill links
      if (!u.searchParams.has("usp")) u.searchParams.set("usp", "pp_url");
      return u.toString();
    } catch {
      return GOOGLE_FORM_URL;
    }
  }, [childValue]);

  return (
    <div className="chat-container" style={{ maxWidth: 900 }}>
      <iframe
        title="Daily Check-In Form"
        src={formSrc}
        width="100%"
        height="1200"      // adjust if your form is taller/shorter
        frameBorder="0"
        style={{ border: 0, background: "#fff" }}
        allow="clipboard-write; encrypted-media; fullscreen"
      />
      <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
        This form saves directly to your Google Sheet.
      </p>
    </div>
  );
}


/* =========================
   Progress (private chart)
========================= */
function ProgressView() {
  const childEmail = getChildEmailFromQuery() || "";
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const loadData = useCallback(async () => {
    try {
      const qs = childEmail ? `?child_email=${encodeURIComponent(childEmail)}` : "";
      const { rows } = await apiGet(`/getCheckins${qs}`);
      setRows(rows || []);
    } catch (e) {
      console.error(e);
      setErr("Could not load check-ins.");
    }
  }, [childEmail]);

  useEffect(() => {
    const captured = captureTokenFromHash();
    const hasToken = captured || !!getStoredToken();
    setReady(hasToken);

    function onStorage(e) {
      if (e.key === "sb_access_token" || e.key === "sb_access_token_exp") {
        setReady(!!getStoredToken());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (ready) loadData();
  }, [ready, loadData]);

  function signOut() {
    clearToken();
    setReady(false);
    setRows([]);
  }

  const chartData = {
    labels: rows.map((r) => new Date(r.checkin_date).toLocaleDateString()),
    datasets: [
      { label: "Mood", data: rows.map((r) => r.mood) },
      { label: "Sleep (hrs)", data: rows.map((r) => r.sleep_hours) },
      { label: "Energy", data: rows.map((r) => r.energy) },
    ],
  };

  return (
    <div className="chat-container" style={{ maxWidth: 900 }}>
      <h1>Progress</h1>
      {!ready ? (
        <>
          <p>Sign in to view your private progress graph.</p>
          <EmailLogin />
        </>
      ) : (
        <>
          {err && <div className="bubble assistant">{err}</div>}
          {rows.length ? <LineChart data={chartData} /> : <p>No data yet.</p>}
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* =========================
   Root App with Tabs
========================= */
function App() {
  // capture token if they land on "/" after magic/OTP
  useEffect(() => {
    captureTokenFromHash();
  }, []);

  const [tab, setTab] = React.useState(getTabFromURL());

  // Keep the URL in sync when the user clicks tabs
  useEffect(() => {
    setTabInURL(tab);
  }, [tab]);

  // Also react to browser back/forward (so embeds can navigate if needed)
  useEffect(() => {
    const onPop = () => setTab(getTabFromURL());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setTab("assistant")}
          className={tab === "assistant" ? "btn-primary" : "btn"}
        >
          Assistant
        </button>
        <button
          onClick={() => setTab("checkin")}
          className={tab === "checkin" ? "btn-primary" : "btn"}
        >
          Check-In (Form)
        </button>
        <button
          onClick={() => setTab("progress")}
          className={tab === "progress" ? "btn-primary" : "btn"}
        >
          Progress (Private)
        </button>
      </div>

      {tab === "assistant" && <AssistantView />}
      {tab === "checkin" && <CheckinFormView />}
      {tab === "progress" && <ProgressView />}
    </div>
  );
}

export default App;
