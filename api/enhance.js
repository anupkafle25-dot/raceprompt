// /api/enhance.js — Vercel Serverless Function
// Proxies Gemini API requests so the key never reaches the browser.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables.');
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

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 1400, topP: 0.95 }
      })
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      const message = errData?.error?.message || `Gemini API responded with status ${geminiRes.status}`;
      console.error('Gemini API error:', message);
      return res.status(geminiRes.status).json({ error: message });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('Failed to parse Gemini JSON output:', clean);
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
