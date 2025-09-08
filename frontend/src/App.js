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
   Check-In Form 
========================= */

function CheckinFormView() {
  // Only read ?email from Tevello ({{ customer.email }})
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preEmail = search.get("email") || "";

  // Form state
  const [name, setName] = React.useState("");
  const [email] = React.useState(preEmail); // prefilled, hidden in UI but sent to API
  const GOALS = ["Fine motor", "Perception", "Handwriting"];
  const ACTIVITIES = [
    "Forerunner - Activity #1","Forerunner - Activity #2","Forerunner - Activity #3","Forerunner - Activity #4","Forerunner - Activity #5",
    "Starter - Activity #6","Starter - Activity #7","Starter - Activity #8","Starter - Activity #9","Starter - Activity #10",
    "Advancer - Activity #11","Advancer - Activity #12","Starter - Activity #13","Starter - Activity #14","Starter - Activity #15"
  ];
  const [goal, setGoal] = React.useState(GOALS[0]);
  const [activity, setActivity] = React.useState(ACTIVITIES[0]);
  const [completion, setCompletion] = React.useState(3); // 1–5
  const [mood, setMood] = React.useState(3);            // 1–5
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !email.trim()) {
      setErr("Please fill out all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/saveCheckins", {
        child_name: name,
        child_email: email, // from Tevello
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
    setGoal(GOALS[0]);
    setActivity(ACTIVITIES[0]);
    setCompletion(3);
    setMood(3);
    setNotes("");
    setName("");
  }

  if (submitted) {
    return (
      <div className="gform-wrap">
        <header className="gform-header">
          <div className="gform-header__inner">
            <h1 className="gform-title">Daily Check In!</h1>
          </div>
        </header>

        <main className="gform-main">
          <section className="gform-card">
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
      <header className="gform-header">
        <div className="gform-header__inner">
          <h1 className="gform-title">Daily Check In!</h1>
          <p className="gform-sub">
            This form is meant to help you track your child's progress.{" "}
            It might be different on different days—you might even need to repeat
            some activities for a couple days. But that's okay! Log it here to
            track progress and celebrate every win!
          </p>
          <p className="gform-sub"><em><span className="req">*</span> Indicates required question</em></p>
        </div>
      </header>

      <main className="gform-main">
        <form className="gform-form" onSubmit={onSubmit} noValidate>
          {/* Hidden email (from Tevello). If you prefer visible read-only, uncomment the visible block below */}
          <input type="hidden" value={email} />

          {/* Child name (short answer, required) */}
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

          {/* If you want to SHOW the email as read-only, replace the hidden input above with this:
          <section className="gform-card">
            <h2 className="gform-q">Email <span className="req">*</span></h2>
            <div className="gform-answer">
              <input className="gform-input" type="email" value={email} readOnly />
              <div className="gform-help">Auto-filled from your Tevello login.</div>
            </div>
          </section>
          */}

          {/* Goal (dropdown) */}
          <section className="gform-card">
            <h2 className="gform-q">Which goal did you work on today?</h2>
            <div className="gform-answer">
              <select className="gform-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </section>

          {/* Activity (dropdown) */}
          <section className="gform-card">
            <h2 className="gform-q">Which activity did you do today?</h2>
            <div className="gform-answer">
              <select className="gform-select" value={activity} onChange={(e) => setActivity(e.target.value)}>
                {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </section>

          {/* Completion (linear scale 1–5 with end labels) */}
          <section className="gform-card">
            <h2 className="gform-q">Did the child complete the task?</h2>
            <div className="gform-scale">
              <div className="gform-scale__label">Did not want to do it</div>
              <div className="gform-scale__grid">
                <div className="gform-scale__nums">
                  {[1,2,3,4,5].map((n) => <div key={n}>{n}</div>)}
                </div>
                <div className="gform-scale__radios" role="radiogroup" aria-label="Completion scale">
                  {[1,2,3,4,5].map((n) => (
                    <label key={n} className="gform-scale__cell">
                      <input
                        type="radio"
                        name="completion"
                        value={n}
                        checked={Number(completion) === n}
                        onChange={() => setCompletion(n)}
                      />
                      <span className="gform-radio" aria-hidden />
                    </label>
                  ))}
                </div>
              </div>
              <div className="gform-scale__label">Completed successfully</div>
            </div>
          </section>

          {/* Mood (linear scale 1–5 with end labels) */}
          <section className="gform-card">
            <h2 className="gform-q">What was the child's mood today?</h2>
            <div className="gform-scale">
              <div className="gform-scale__label">Dysregulated</div>
              <div className="gform-scale__grid">
                <div className="gform-scale__nums">
                  {[1,2,3,4,5].map((n) => <div key={n}>{n}</div>)}
                </div>
                <div className="gform-scale__radios" role="radiogroup" aria-label="Mood scale">
                  {[1,2,3,4,5].map((n) => (
                    <label key={n} className="gform-scale__cell">
                      <input
                        type="radio"
                        name="mood"
                        value={n}
                        checked={Number(mood) === n}
                        onChange={() => setMood(n)}
                      />
                      <span className="gform-radio" aria-hidden />
                    </label>
                  ))}
                </div>
              </div>
              <div className="gform-scale__label">Regulated</div>
            </div>
          </section>

          {/* Notes (paragraph) */}
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

          {/* Error (matches GF red card feel) */}
          {err && (
            <section className="gform-card gform-card--error">
              <p className="gform-error">{err}</p>
            </section>
          )}

          {/* Actions */}
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
  const childEmail = getChildEmailFromQuery() || "";
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  // Load data for this child
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

  // Auth token capture & ready state
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

  useEffect(() => { if (ready) loadData(); }, [ready, loadData]);

  function signOut() {
    clearToken();
    setReady(false);
    setRows([]);
  }

  // Normalize rows -> {date, goal, activity, completion, mood}
  const norm = rows
    .map((r) => ({
      date: r.checkin_date || r.created_at || r.date, // support various backends
      goal: (r.goal || r.goal_name || "").trim(),
      activity: (r.activity || r.activity_name || "").trim(),
      completion: r.completion_score ?? null,
      mood: r.mood_score ?? null,
    }))
    .filter((r) => r.date && r.goal && r.activity && r.completion != null && r.mood != null);

  // Group by goal (case-insensitive, keep first-seen casing for title)
  const byGoal = norm.reduce((acc, r) => {
    const key = r.goal.toLowerCase();
    if (!acc[key]) acc[key] = { title: r.goal, rows: [] };
    acc[key].rows.push(r);
    return acc;
  }, {});

  const goalKeys = Object.keys(byGoal); // 0..3 goals depending on data

  return (
    <div className="chat-container" style={{ maxWidth: 980 }}>
      <h1>Progress</h1>

      {!ready ? (
        <>
          <p>Sign in to view your private progress graphs.</p>
          <EmailLogin />
        </>
      ) : (
        <>
          {err && <div className="bubble assistant">{err}</div>}

          {goalKeys.length === 0 ? (
            <p>No data yet.</p>
          ) : (
            goalKeys.map((k) => {
              const { title, rows: gRows } = byGoal[k];

              // sort by date ASC
              const sorted = [...gRows].sort(
                (a, b) => new Date(a.date) - new Date(b.date)
              );
              const labels = sorted.map((r) => fmtDate(r.date));

              // Build point arrays with activity on each point
              const completionData = sorted.map((r) => ({
                x: fmtDate(r.date),
                y: Number(r.completion),
                _activity: r.activity,
              }));
              const moodData = sorted.map((r) => ({
                x: fmtDate(r.date),
                y: Number(r.mood),
                _activity: r.activity,
              }));

              // Activity legend for this goal
              const activities = Array.from(
                new Set(sorted.map((r) => r.activity).filter(Boolean))
              );

              const data = {
                labels,
                datasets: [
                  {
                    label: "Completion score",
                    data: completionData,
                    fill: false,
                    borderWidth: 3,
                    tension: 0.25,
                    // Color each segment by the activity of the segment's end point
                    segment: {
                      borderColor: (ctx) => {
                        const a = ctx?.p1?.raw?._activity;
                        return getActivityColor(a);
                      },
                    },
                    // Color each point by its activity (helps when points are sparse)
                    pointRadius: 3,
                    pointBackgroundColor: (ctx) =>
                      getActivityColor(completionData[ctx.dataIndex]?._activity),
                  },
                  {
                    label: "Mood",
                    data: moodData,
                    fill: false,
                    borderWidth: 3,
                    borderDash: [6, 4], // visually distinct from completion
                    tension: 0.25,
                    segment: {
                      borderColor: (ctx) => {
                        const a = ctx?.p1?.raw?._activity;
                        return getActivityColor(a);
                      },
                    },
                    pointRadius: 3,
                    pointBackgroundColor: (ctx) =>
                      getActivityColor(moodData[ctx.dataIndex]?._activity),
                  },
                ],
              };

              const options = {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "top" },
                  tooltip: {
                    callbacks: {
                      // Show activity per point in tooltip
                      label: (tt) => {
                        const dsLabel = tt.dataset.label || "";
                        const raw = tt.raw || {};
                        const act = raw._activity ? ` • ${raw._activity}` : "";
                        return `${dsLabel}: ${tt.formattedValue}${act}`;
                      },
                    },
                  },
                },
                scales: {
                  x: { title: { display: true, text: "Date" } },
                  y: {
                    min: 1,
                    max: 5, // both completion & mood are 1–5
                    ticks: { stepSize: 1 },
                    title: { display: true, text: "Score (1–5)" },
                  },
                },
              };

              return (
                <div key={k} style={{ margin: "16px 0" }}>
                  <h2 style={{ marginBottom: 8 }}>{title}</h2>

                  {/* Activity legend */}
                  {activities.length > 0 && (
                    <div className="activity-legend" style={{ marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {activities.map((a) => (
                        <span key={a} className="activity-chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              display: "inline-block",
                              background: getActivityColor(a),
                            }}
                          />
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ height: 360 }}>
                    <LineChart data={data} options={options} />
                  </div>
                </div>
              );
            })
          )}

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={signOut}>Sign out</button>
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
