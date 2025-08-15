// === Step 2: Node.js Backend (server/index.js) ===

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = 'asst_9t8RWI3CIUU5w94NbIcq83F6'; // Replace with your real assistant ID

app.post('/api/ask-attune', async (req, res) => {
  const userInput = req.body.message;
  const thread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: userInput
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId
  });

  let runStatus;
  do {
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    await new Promise((r) => setTimeout(r, 1500));
  } while (runStatus.status !== 'completed');

  const messages = await openai.beta.threads.messages.list(thread.id);
  const reply = messages.data[0].content[0].text.value;

  res.json({ reply });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
