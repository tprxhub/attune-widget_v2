// frontend/src/App.js
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@supabase/supabase-js";
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

/* =========================
   Shared helpers (unchanged)
========================= */
function normalizeBullets(s = "") {
  return s
    .replace(/\r\n?/g, "\n") // normalize line endings
    .replace(/(^|\n)\s*(\d+)\.\s*\n+/g, "$1$2. ") // "1.\n" -> "1. "
    .replace(/(^|\n)\s*([-*•])\s*\n+/g, "$1$2 "); // "-\n"  -> "- "
}
const API_BASE = process.env.REACT_APP_BACKEND_URL || "/api"; // for your assistant only
const stripCitations = (text = "") => text.replace(/【[^】]*】/g, "");
const fixInlineEnumerations = (t = "") =>
  t.replace(/(\S) ([0-9]+)\.\s/g, (_, prev, num) => `${prev} ${num}) `);
const renderText = (t = "") =>
  fixInlineEnumerations(stripCitations(normalizeBullets(t)));

/* =========================================
   NEW: Supabase + API client for check-ins
========================================= */
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function getBearer() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiGet(path) {
  const token = await getBearer();
  const res = await fetch(`${process.env.REACT_APP_API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const token = await getBearer();
  const res = await fetch(`${process.env.REACT_APP_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
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
                li: ({ node, ...props }) => (
                  <li style={{ fontWeight: 400 }} {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p style={{ margin: "4px 0" }} {...props} />
                ),
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
   NEW: Check-in UI
========================= */
function EmailLogin() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function sendLink(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");

    // Redirect back to your app at /checkin and keep any ?email=... from Tevello
    const redirectTo = `${window.location.origin}/checkin${window.location.search || ""}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) setErr(error.message || "Could not send magic link");
    else setSent(true);

    setBusy(false);
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
  const childEmail = getChildEmailFromQuery() || "child@example.com"; // Tevello can pass ?email={{customer.email}}
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Watch auth
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setReady(!!session);
      if (session) loadData();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setReady(!!session);
      if (session) loadData();
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function loadData() {
    try {
      const qs = childEmail ? `?child_email=${encodeURIComponent(childEmail)}` : "";
      const { rows } = await apiGet(`/getCheckins${qs}`);
      setRows(rows || []);
    } catch (e) {
      console.error(e);
      setErr("Could not load check-ins.");
    }
  }

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
      <p>Child: <b>{childEmail}</b></p>

      <form onSubmit={submit} className="composer" style={{ display: "grid", gap: 12 }}>
        <label>Mood (1–5)
          <input type="range" min="1" max="5" value={mood} onChange={(e) => setMood(e.target.value)} />
        </label>
        <label>Sleep (hours)
          <input type="number" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </label>
        <label>Energy (1–10)
          <input type="range" min="1" max="10" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </label>
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Submit"}</button>
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
  const [tab, setTab] = useState("assistant"); // "assistant" | "checkin"

  return (
    <div>
      {/* Simple tab header */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid #eee",
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 10
      }}>
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
  );
}

export default App;
