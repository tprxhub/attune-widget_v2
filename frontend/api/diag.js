export default function handler(req, res) {
  res.status(200).json({
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    assistantId: process.env.ATTUNE_ASSISTANT_ID ? 'set' : 'missing'
  });
}
