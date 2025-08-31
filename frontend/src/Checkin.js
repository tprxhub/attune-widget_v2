import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

export default function Checkin({ email }) {
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await fetch(`${process.env.REACT_APP_API_URL}/saveCheckin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mood, sleep, energy }),
    });
    if (res.ok) {
      setSubmitted(true);
      fetchData();
    }
  }

  async function fetchData() {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/getCheckins?email=${email}`);
    const json = await res.json();
    setData(json.rows || []);
  }

  useEffect(() => { fetchData(); }, []);

  const chartData = {
    labels: data.map((row) => new Date(row[0]).toLocaleDateString()),
    datasets: [
      { label: "Mood", data: data.map((row) => row[2]), borderColor: "blue" },
      { label: "Sleep", data: data.map((row) => row[3]), borderColor: "green" },
      { label: "Energy", data: data.map((row) => row[4]), borderColor: "orange" },
    ],
  };

  return (
    <div className="p-4">
      <h1>Daily Check-In</h1>
      <form onSubmit={handleSubmit}>
        <p>Email: <b>{email}</b></p>
        <label>Mood (1–5)</label>
        <input type="range" min="1" max="5" value={mood} onChange={e=>setMood(e.target.value)} />
        <label>Sleep (hours)</label>
        <input type="number" value={sleep} onChange={e=>setSleep(e.target.value)} />
        <label>Energy (1–10)</label>
        <input type="range" min="1" max="10" value={energy} onChange={e=>setEnergy(e.target.value)} />
        <button type="submit">Submit</button>
      </form>

      <h2>Progress</h2>
      {data.length > 0 ? <Line data={chartData}/> : <p>No data yet</p>}
    </div>
  );
}
