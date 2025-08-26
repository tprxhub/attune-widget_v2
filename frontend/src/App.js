import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

function normalizeBullets(s) {
  return s
    // "1.\nText" -> "1. Text"
    .replace(/(^|\n)(\s*)(\d+)\.\s*\n(\S)/g, '$1$2$3. $4')
    // "-\nText" or "•\nText" or "*\nText" -> "- Text"
    .replace(/(^|\n)(\s*)([-*•])\s*\n(\S)/g, '$1$2$3 $4');
}

const API_BASE = process.env.REACT_APP_BACKEND_URL || '/api';
const stripCitations = (text = '') => text.replace(/【[^】]*】/g, '');
const fixInlineEnumerations = (t = "") =>
  // only convert " 2. " when it's a SPACE (not a newline) before the number
  t.replace(/(\S) ([0-9]+)\.\s/g, (_, prev, num) => `${prev} ${num}) `);

const renderText = (t = "") => fixInlineEnumerations(stripCitations(t));


function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef(null);

  // auto-scroll to newest message
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    setError('');
    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ask-attune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Request failed: ${response.status}`);

      const botMessage = { role: 'assistant', content: normalizeBullets(data.reply) };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      setError('Sorry — something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h1>Attune™ by ToyRx</h1>
      <div className="chat-box" ref={boxRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`bubble ${msg.role}`}>
            <ReactMarkdown
              components={{
                // Ensure list items never inherit unintended bold
                li: ({node, ...props}) => <li style={{fontWeight: 400}} {...props} />,
                // Keep paragraph spacing tight
                p: ({node, ...props}) => <p style={{margin: '4px 0'}} {...props} />,
                ul: ({node, ...props}) => <ul style={{margin:'4px 0', paddingLeft:'1.1rem'}} {...props} />,
                ol: ({node, ...props}) => <ol style={{margin:'4px 0', paddingLeft:'1.1rem'}} {...props} />
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
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>Send</button>
      </div>
    </div>
  );
}

export default App;
