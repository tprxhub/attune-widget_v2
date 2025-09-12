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


// Optional: set a custom header image (or leave empty string to keep purple header)
// You can also set this in Vercel as REACT_APP_CHECKIN_HEADER_IMAGE_URL
const CHECKIN_HEADER_IMAGE_URL =
  process.env.REACT_APP_CHECKIN_HEADER_IMAGE_URL || "";

function isEmbedded() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("embed") === "1";
  } catch {
    return false;
  }
}


// ---------- Activity color mapping (stable & dynamic) ----------
const ACTIVITY_PALETTE = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  "#4e79a7", "#f28e2b", "#76b7b2", "#59a14f", "#edc948",
  "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"
];

// Simple hash to map any activity string -> stable palette index
function hashStringToIndex(str = "", mod = ACTIVITY_PALETTE.length) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}
function getActivityColor(activity = "") {
  return ACTIVITY_PALETTE[hashStringToIndex(activity)];
}

// Format date label (keeps your existing locale display)
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}


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

function InlineOtpGate({ email, onReady }) {
  const API_ROOT = process.env.REACT_APP_API_URL || "/api";
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API_ROOT}/startOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not send code");
      setSent(true);
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API_ROOT}/verifyOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) throw new Error(j.error || "Invalid code");

      const expAt = Date.now() + (j.expires_in || 3600) * 1000;
      localStorage.setItem("sb_access_token", j.access_token);
      localStorage.setItem("sb_access_token_exp", String(expAt));
      onReady?.();
    } catch (e) {
      setErr(e.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gform-card">
      <h2 className="gform-q">Verify your email</h2>
      <p className="gform-help" style={{ marginBottom: 8 }}>
        We’ll send a 6-digit code to <b>{email}</b> to protect your child’s data.
      </p>
      {err && <p className="gform-error" style={{ marginBottom: 8 }}>{err}</p>}

      {!sent ? (
        <button className="gform-submit" onClick={sendCode} disabled={busy || !email}>
          {busy ? "Sending…" : "Send code"}
        </button>
      ) : (
        <form onSubmit={verifyCode} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto", alignItems: "center" }}>
          <input
            className="gform-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className="gform-submit" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </div>
  );
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

function hasBearerToken() {
  return !!getStoredToken();
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
   Check-In Form 
========================= */
function CheckinFormView() {
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preEmail = search.get("email") || "";

  // Hidden but logged
  const [email] = React.useState(preEmail);

  // Visible fields (no preselection)
  const [name, setName] = React.useState("");
  const GOALS = ["Fine motor", "Perception", "Handwriting"];
  const ACTIVITIES = [
    "Forerunner - Activity #1","Forerunner - Activity #2","Forerunner - Activity #3","Forerunner - Activity #4","Forerunner - Activity #5",
    "Starter - Activity #6","Starter - Activity #7","Starter - Activity #8","Starter - Activity #9","Starter - Activity #10",
    "Advancer - Activity #11","Advancer - Activity #12","Starter - Activity #13","Starter - Activity #14","Starter - Activity #15"
  ];

  const [goal, setGoal] = React.useState("");
  const [activity, setActivity] = React.useState("");
  const [completion, setCompletion] = React.useState(null); // 1–5
  const [mood, setMood] = React.useState(null);             // 1–5
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [err, setErr] = React.useState("");

  const hasHeaderImage = !!CHECKIN_HEADER_IMAGE_URL;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!name.trim()) return setErr("Please enter the child's name.");
    if (!email.trim()) return setErr("Missing child email from Tevello.");
    if (!goal) return setErr("Please select a goal.");
    if (!activity) return setErr("Please select an activity.");
    if (completion == null) return setErr("Please select a completion score.");
    if (mood == null) return setErr("Please select a mood score.");

    setSubmitting(true);
    try {
      await apiPost("/saveCheckins", {
        child_name: name,
        child_email: email,
        goal,
        activity,
        completion_score: Number(completion),
        mood_score: Number(mood),
        notes: notes || null,
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setErr("Could not submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setName("");
    setGoal("");
    setActivity("");
    setCompletion(null);
    setMood(null);
    setNotes("");
  }

  if (submitted) {
    return (
      <div className="gform-wrap">
        <main className="gform-main">
          {hasHeaderImage && (
            <div
              className="gform-banner"
              style={{ backgroundImage: `url(${CHECKIN_HEADER_IMAGE_URL})` }}
              aria-label="Header image"
            />
          )}

          <section className="gform-card gform-intro">
            <h1 className="gform-title">Daily Check In!</h1>
            <p className="gform-text">Your response has been recorded.</p>
            <button type="button" className="gform-link" onClick={resetForm}>
              Submit another response
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="gform-wrap">
      <main className="gform-main">
        {hasHeaderImage && (
          <div
            className="gform-banner"
            style={{ backgroundImage: `url(${CHECKIN_HEADER_IMAGE_URL})` }}
            aria-label="Header image"
          />
        )}

        {/* Intro card BELOW the image, same width as questions */}
        <section className="gform-card gform-intro">
          <h1 className="gform-title">Daily Check In!</h1>
          <p className="gform-sub">
            This form is meant to help you track your child's progress. It might be
            different on different days—you might even need to repeat some activities
            for a couple days. But that's okay! Log it here to track progress and
            celebrate every win!
          </p>
          <p className="gform-sub">
            <em><span className="req">*</span> Indicates required question</em>
          </p>
        </section>

        <form className="gform-form" onSubmit={onSubmit} noValidate>
          {/* Hidden email from Tevello (logged but not shown) */}
          <input type="hidden" value={email} />

          {/* Child name (required) */}
          <section className="gform-card">
            <h2 className="gform-q">
              What is the child's name? <span className="req">*</span>
            </h2>
            <div className="gform-answer">
              <input
                className="gform-input"
                type="text"
                placeholder="Your answer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </section>

          {/* Goal (dropdown — starts blank, no "Select" label) */}
          <section className="gform-card">
            <h2 className="gform-q">
              Which goal did you work on today? <span className="req">*</span>
            </h2>
            <div className="gform-answer">
              <select
                className="gform-select"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              >
                <option value="" disabled></option>
                {GOALS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Activity (dropdown — starts blank) */}
          <section className="gform-card">
            <h2 className="gform-q">
              Which activity did you do today? <span className="req">*</span>
            </h2>
            <div className="gform-answer">
              <select
                className="gform-select"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                required
              >
                <option value="" disabled></option>
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Completion (labels above 1 and 5; right label above 5) */}
          <section className="gform-card">
            <h2 className="gform-q">
              Did the child complete the task? <span className="req">*</span>
            </h2>
            <div className="gform-scale">
              <div className="gform-scale__grid">
                <div className="gform-scale__labels">
                  <div className="left">Did not want to do it</div>
                  <div className="right">Completed successfully</div>
                </div>
                <div className="gform-scale__nums">
                  {[1,2,3,4,5].map((n) => <div key={n}>{n}</div>)}
                </div>
                <div className="gform-scale__radios" role="radiogroup" aria-label="Completion scale">
                  {[1,2,3,4,5].map((n, i) => (
                    <label key={n} className="gform-scale__cell">
                      <input
                        type="radio"
                        name="completion"
                        value={n}
                        checked={completion === n}
                        onChange={() => setCompletion(n)}
                        required={i === 0}
                      />
                      <span className="gform-radio" aria-hidden />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Mood (labels above 1 and 5; right label above 5) */}
          <section className="gform-card">
            <h2 className="gform-q">
              What was the child's mood today? <span className="req">*</span>
            </h2>
            <div className="gform-scale">
              <div className="gform-scale__grid">
                <div className="gform-scale__labels">
                  <div className="left">Dysregulated</div>
                  <div className="right">Regulated</div>
                </div>
                <div className="gform-scale__nums">
                  {[1,2,3,4,5].map((n) => <div key={n}>{n}</div>)}
                </div>
                <div className="gform-scale__radios" role="radiogroup" aria-label="Mood scale">
                  {[1,2,3,4,5].map((n, i) => (
                    <label key={n} className="gform-scale__cell">
                      <input
                        type="radio"
                        name="mood"
                        value={n}
                        checked={mood === n}
                        onChange={() => setMood(n)}
                        required={i === 0}
                      />
                      <span className="gform-radio" aria-hidden />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Notes (optional) */}
          <section className="gform-card">
            <h2 className="gform-q">Other Observations or Notes:</h2>
            <div className="gform-answer">
              <textarea
                className="gform-textarea"
                rows={4}
                placeholder="Your answer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>

          {err && (
            <section className="gform-card gform-card--error">
              <p className="gform-error">{err}</p>
            </section>
          )}

          <section className="gform-actions">
            <button className="gform-submit" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <span className="gform-required">
              <span className="req">*</span> Required
            </span>
          </section>
        </form>
      </main>
    </div>
  );
}


/* =========================
   Progress (private chart)
========================= */
function ProgressView() {
  const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const childEmail = qs.get("email") || "";

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const q = childEmail ? `?child_email=${encodeURIComponent(childEmail)}` : "";
        const { rows: data = [] } = await apiGet(`/getCheckins${q}`);
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setErr(e.message || "Failed to load progress.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [childEmail]);

  // ---- helpers for styling the completion series by segment ----
  const GOAL_COLORS = {
    "Fine motor": "#e74c3c",   // red
    "Perception": "#3498db",   // blue
    "Handwriting": "#2ecc71",  // green
  };
  const labels = rows.map(r =>
    (r.checkin_date ? new Date(r.checkin_date) : new Date(r.created_at)).toLocaleDateString()
  );
  const completion = rows.map(r => Number(r.completion_score ?? null));
  const mood = rows.map(r => Number(r.mood_score ?? null));
  const goalsMeta = rows.map(r => r.goal || "");
  const activitiesMeta = rows.map(r => r.activity || "");
  const activityNums = rows.map(r => {
    const m = String(r.activity || "").match(/#(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  });

  const colorForIndex = (i) => GOAL_COLORS[goalsMeta[i]] || "#555";
  const dashForIndex = (i) => {
    const a = (activitiesMeta[i] || "").toLowerCase();
    if (a.startsWith("forerunner")) return [2, 4];   // dotted
    if (a.startsWith("starter"))    return [6, 4];   // dashed
    if (a.startsWith("advancer"))   return [];       // solid
    return []; // default solid
  };
  const widthForIndex = (i) => {
    const n = activityNums[i] || 1;               // 1..15 (ish)
    // map 1..15 -> 2..6 px
    const clamped = Math.max(1, Math.min(15, n));
    return 2 + ((clamped - 1) / 14) * 4;
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: "Completion score",
        data: completion,
        spanGaps: true,
        tension: 0.25,
        pointRadius: 3,
        borderColor: "#000", // fallback; real color set per-segment below
        segment: {
          borderColor: (ctx) => colorForIndex(ctx.p1DataIndex),
          borderDash:  (ctx) => dashForIndex(ctx.p1DataIndex),
          borderWidth: (ctx) => widthForIndex(ctx.p1DataIndex),
        },
      },
      {
        label: "Mood",
        data: mood,
        tension: 0.25,
        pointRadius: 2,
        borderColor: "#777",
        backgroundColor: "#777",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 1,
        max: 5,
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const i = items[0].dataIndex;
            const goal = goalsMeta[i] || "—";
            const act  = activitiesMeta[i] || "—";
            return [`Goal: ${goal}`, `Activity: ${act}`];
          },
        },
      },
    },
  };

  return (
    <div className="chat-container" style={{ maxWidth: 900 }}>
      <h1>Progress</h1>
      {childEmail ? (
        <p style={{ margin: "6px 0 14px" }}>
          Child email: <b>{childEmail}</b>
        </p>
      ) : (
        <p className="gform-error">Missing ?email= in URL.</p>
      )}

      {err && <div className="bubble assistant">{err}</div>}
      {loading ? (
        <div className="bubble assistant">Loading…</div>
      ) : rows.length ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, height: 420 }}>
          <LineChart data={chartData} options={options} />
          <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
            Key: <span style={{ color: "#e74c3c" }}>Fine motor</span> •{" "}
            <span style={{ color: "#3498db" }}>Perception</span> •{" "}
            <span style={{ color: "#2ecc71" }}>Handwriting</span> &nbsp;|&nbsp;
            Line style: Forerunner = dotted, Starter = dashed, Advancer = solid. Line width scales with activity number.
          </div>
        </div>
      ) : (
        <p>No data yet.</p>
      )}
    </div>
  );
}

export default App;
