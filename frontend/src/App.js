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
      const response = await fetch(`${API_BASE}/ask-attune_
