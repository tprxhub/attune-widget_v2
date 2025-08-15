// === Step 1: React Frontend (frontend/src/App.js) ===

import React, { useState } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    const response = await fetch('/api/ask-attune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input })
    });

    const data = await response.json();
    const botMessage = { role: 'assistant', content: data.reply };
    setMessages((prev) => [...prev, botMessage]);
    setLoading(false);
  };

  return (
    <div className="chat-container">
      <h1>Attune™ by ToyRx</h1>
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role}>{msg.content}</div>
        ))}
        {loading && <div className="assistant">Attune is thinking...</div>}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask your question here..."
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;
