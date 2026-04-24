// /api/enhance.js — Vercel Serverless Function
// Proxies OpenRouter API requests so the key never reaches the browser.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY is not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  const { prompt, tone } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'Missing or empty "prompt" in request body.' });
  }

  if (!tone || typeof tone !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "tone" in request body.' });
  }

  const systemPrompt = buildPrompt(prompt.trim(), tone);

  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

  try {
    const apiRes = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // You can change this to any OpenRouter model
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.85,
        max_tokens: 1400,
        top_p: 0.95
      })
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      const message = errData?.error?.message || `OpenRouter API responded with status ${apiRes.status}`;
      console.error('OpenRouter API error:', message);
      return res.status(apiRes.status).json({ error: message });
    }

    const data = await apiRes.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    const clean = rawText.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('Failed to parse JSON output:', clean);
      return res.status(502).json({ error: 'Received invalid JSON from AI model. Please try again.' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Unexpected error in /api/enhance:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}

/* ── Prompt Builder ── */
function buildPrompt(userPrompt, tone) {
  return `You are an elite AI prompt engineer specializing in the R.A.C.E. framework. Enhance the user's rough prompt into a precision-crafted version with a ${tone} tone.

R.A.C.E. Framework:
- Role: The expert persona the AI should embody
- Action: The specific, precise task to perform
- Context: Audience, background, constraints, and details
- Expectation: Exact output format, length, quality, and style requirements

Return ONLY valid JSON (no markdown fences, no preamble):
{
  "enhanced": "One cohesive, polished prompt combining all RACE elements naturally",
  "role": "Specific role/persona description",
  "action": "Clear, precise action statement",
  "context": "Audience, background, constraints, and relevant details",
  "expectation": "Exact format, length, tone, and quality expectations"
}

User's rough prompt: "${userPrompt}"
Tone: ${tone}`;
}
