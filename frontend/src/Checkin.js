import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './lib/apiClient';
import { supabase } from './lib/supabaseClient';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

export default function Checkin({ childEmail }) {
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(5);
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);

  // Require auth: if no session, prompt sign-in (magic link or password)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setReady(!!session);
      if (session) load();
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function load() {
    const qs = childEmail ? `?child_email=${encodeURIComponent(childEmail)}` : '';
    const { rows } = await apiGet(`/getCheckins${qs}`);
    setRows(rows);
  }

  async function submit(e) {
    e.preventDefault();
    await apiPost('/saveCheckins', {
      child_email: childEmail,
      mood: Number(mood),
      sleep_hours: Number(sleep),
      energy: Number(energy),
    });
    await load();
  }

  useEffect(() => { if (ready) load(); }, [ready]);

  const chartData = {
    labels: rows.map(r => new Date(r.checkin_date).toLocaleDateString()),
    datasets: [
      { label: 'Mood',        data: rows.map(r => r.mood) },
      { label: 'Sleep (hrs)', data: rows.map(r => r.sleep_hours) },
      { label: 'Energy',      data: rows.map(r => r.energy) }
    ]
  };

  if (!ready) {
    return (
      <div style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h3>Sign in to view your tracker</h3>
        <EmailLogin />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '2rem auto' }}>
      <h2>Daily Check-In</h2>
      <p>Child: <b>{childEmail}</b></p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>Mood (1–5) <input type="range" min="1" max="5" value={mood} onChange={e=>setMood(e.target.value)} /></label>
        <label>Sleep (hrs) <input type="number" value={sleep} onChange={e=>setSleep(e.target.value)} /></label>
        <label>Energy (1–10) <input type="range" min="1" max="10" value={energy} onChange={e=>setEnergy(e.target.value)} /></label>
        <button type="submit">Submit</button>
      </form>

      <h3 style={{ marginTop: 24 }}>Progress</h3>
      {rows.length ? <Line data={chartData} /> : <p>No data yet.</p>}
    </div>
  );
}

// minimal email magic-link sign-in
function EmailLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function sendLink(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if (!error) setSent(true);
  }

  return sent
    ? <p>Check your email for a magic link.</p>
    : (
      <form onSubmit={sendLink} style={{ display: 'grid', gap: 12 }}>
        <input type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required />
        <button type="submit">Send magic link</button>
      </form>
    );
}
