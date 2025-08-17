// server/api/ask-attune.js

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = 'asst_9t8RWI3CIUU5w94NbIcq83F6' //process.env.ATTUNE_ASSISTANT_ID; // set in Vercel env

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    // CORS preflight (optional, use your frontend domain)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  try {
    const thread = await client.beta.threads.create();
    await client.beta.threads.messages.create(thread.id, { role: "user", content: message });

    const run = await client.beta.threads.runs.create(thread.id, { assistant_id: ASSISTANT_ID });

    // poll for completion (keep it short—serverless has time limits)
    let status = "queued";
    for (let i = 0; i < 20 && status !== "completed"; i++) {
      await new Promise(r => setTimeout(r, 1200));
      const current = await client.beta.threads.runs.retrieve(thread.id, run.id);
      status = current.status;
      if (["failed", "cancelled", "expired"].includes(status)) {
        throw new Error(`Run ${status}`);
      }
    }

    const msgs = await client.beta.threads.messages.list(thread.id, { limit: 1 });
    const text = msgs.data?.[0]?.content?.[0]?.text?.value ?? "No reply.";
    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
