// frontend/src/App.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
// charts — keep this block ONCE only
import { Line as LineChart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

import "./App.css";

// --- DEV GUARD: block any client call to supabase.co so we see it fast ---
if (typeof window !== 'undefined') {
  const _fetch = window.fetch;
  window.fetch = (...args) => {
    const url = String(args[0] || '');
    if (url.includes('supabase.co')) {
      console.warn('[BLOCKED CLIENT CALL TO SUPABASE]', url);
      return Promise.reject(new Error('Client must not call supabase.co (use /api instead).'));
    }
    return _fetch(...args);
  };
}

/* =========================
   Error Boundary (avoid blank page)
========================= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, msg: err?.message || "Something went wrong" };
  }
  componentDidCatch(err, info) {
    console.error("ErrorBoundary caught:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="chat-container">
          <h2>Oops — something broke.</h2>
          <p>{this.state.msg}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================
   Shared helpers (unchanged)
========================= */
function normalizeBullets(s = "") {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/(^|\n)\s*(\d+)\.\s*\n+/g, "$1$2. ")
    .replace(/(^|\n)\s*([-*•])\s*\n+/g, "$1$2 ");
}
const API_BASE = process.env.REACT_APP_BACKEND_URL || "/api"; // assistant only
const API_ROOT = process.env.REACT_APP_API_URL || "/api";     // check-in APIs

const stripCitations = (text = "") => text.replace(/【[^】]*】/g, "");
const fixInlineEnumerations = (t = "") =>
  t.replace(/(\S) ([0-9]+)\.\s/g, (_, prev, num) => `${prev} ${num}) `);
const renderText = (t = "") =>
  fixInlineEnumerations(stripCitations(normalizeBullets(t)));

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
  const hash = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
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

function getChildEmailFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("email") || "";
  } catch {
    return "";
  }
}

/* =========================
   Assistant UI (existing)
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

      const botMessage = {
        role: "assistant",
        content: normalizeBullets(data.reply),
      };
      setMessages((prev) => [...prev, botMessage]);
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
   Check-in UI
========================= */
function EmailLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");

    const redirectTo = `${window.location.origin}/checkin${window.location.search || ""}`;

    try {
      const res = await fetch(`${API_ROOT}/sendMagicLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send magic link");
      setSent(true);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <p>Check your inbox for a magic link.</p>;

  return (
    <form onSubmit={sendLink} style={{ display: "grid", gap: 12 }}>
      {err && <div className="bubble assistant">{err}</div>}
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={busy}>
        {busy ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}

function CheckinView() {
  const childEmail = getChildEmailFromQuery() || "child@example.com";
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Memoized loader prevents use-before-def in effects
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

  // Capture token at mount, then set ready based on storage
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

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await apiPost("/saveCheckins", {
        child_email: childEmail,
        mood: Number(mood),
        sleep_hours: Number(sleep),
        energy: Number(energy),
      });
      await loadData();
    } catch (e) {
      console.error(e);
      setErr("Could not save your check-in.");
    } finally {
      setSaving(false);
    }
  }

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

  if (!ready) {
    return (
      <div className="chat-container" style={{ maxWidth: 520 }}>
        <h1>Daily Check-In</h1>
        <p>Please sign in to view and submit check-ins.</p>
        <EmailLogin />
      </div>
    );
  }

  return (
    <div className="chat-container" style={{ maxWidth: 640 }}>
      <h1>Daily Check-In</h1>
      <p>
        Child: <b>{childEmail}</b>
      </p>

      <form onSubmit={submit} className="composer" style={{ display: "grid", gap: 12 }}>
        <label>
          Mood (1–5)
          <input
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
        </label>
        <label>
          Sleep (hours)
          <input type="number" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </label>
        <label>
          Energy (1–10)
          <input
            type="range"
            min="1"
            max="10"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Submit"}
          </button>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </form>

      <h2 style={{ marginTop: 24 }}>Progress</h2>
      {err && <div className="bubble assistant">{err}</div>}
      {rows.length ? <LineChart data={chartData} /> : <p>No data yet.</p>}
    </div>
  );
}

/* =========================
   Root App with Tabs
========================= */
function App() {
  // Also capture if they land on "/"
  useEffect(() => {
    captureTokenFromHash();
  }, []);

  const [tab, setTab] = useState("assistant"); // "assistant" | "checkin"

  return (
    <ErrorBoundary>
      <div>
        {/* Simple tab header */}
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
            Daily Check-In
          </button>
        </div>

        {/* Views */}
        {tab === "assistant" ? <AssistantView /> : <CheckinView />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
