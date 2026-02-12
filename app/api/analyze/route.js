// app/api/analyze/route.js
// ─────────────────────────────────────────────────────────
// Secure proxy: frontend calls this → this calls Anthropic
// API key never leaves the server.
// ─────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '50', 10);
const MAX_INPUT_LENGTH = 5000; // characters

// Simple in-memory rate limiter (resets on cold start / redeploy)
// For production at scale, use Vercel KV or Upstash Redis
const rateLimitMap = new Map();

function getRateLimitKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${ip}:${today}`;
}

function checkRateLimit(key) {
  const count = rateLimitMap.get(key) || 0;
  if (count >= RATE_LIMIT) return false;
  rateLimitMap.set(key, count + 1);
  // Clean old keys periodically (keep map small)
  if (rateLimitMap.size > 10000) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [k] of rateLimitMap) {
      if (!k.endsWith(today)) rateLimitMap.delete(k);
    }
  }
  return true;
}

export async function POST(request) {
  // ── Validate API key is configured ──
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
    return Response.json(
      { error: 'Server not configured. Add ANTHROPIC_API_KEY to environment variables.' },
      { status: 500 }
    );
  }

  // ── Rate limit ──
  const rlKey = getRateLimitKey(request);
  if (!checkRateLimit(rlKey)) {
    return Response.json(
      { error: 'Rate limit reached. Try again tomorrow.' },
      { status: 429 }
    );
  }

  // ── Parse & validate input ──
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message } = body;

  if (!message || typeof message !== 'string') {
    return Response.json({ error: 'Missing "message" field' }, { status: 400 });
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return Response.json({ error: 'Message is empty' }, { status: 400 });
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return Response.json(
      { error: `Message too long. Max ${MAX_INPUT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // ── Call Anthropic ──
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are Social Radar, a brutally honest communication analyst. Analyze this message and return ONLY valid JSON. No markdown, no backticks, no preamble.

MESSAGE:
"""
${trimmed}
"""

Return this exact JSON:
{
  "verdict": "GREEN FLAG|PROCEED WITH CAUTION|RED FLAG DETECTED|NEUTRAL SIGNAL|MIXED SIGNALS",
  "verdict_emoji": "🟢|🟡|🔴|⚪|🟠",
  "scores": {
    "interest": <0-100>,
    "honesty": <0-100>,
    "power": <0-100>,
    "anxiety": <0-100>,
    "manipulation": <0-100>
  },
  "translation": "<2-3 sentences, brutally honest, witty. What they ACTUALLY mean.>",
  "hidden_tone": "<1 short sentence: the real emotional undercurrent>",
  "red_flags": ["<flag>", ...],
  "green_flags": ["<flag>", ...],
  "power_dynamic": "<1 sentence>",
  "advice": "<1-2 sentences practical advice>",
  "replies": {
    "assertive": "<A confident, boundary-setting response. 1-2 sentences.>",
    "chill": "<A calm, low-pressure response. 1-2 sentences.>",
    "mirror": "<Match their energy back at them. 1-2 sentences.>"
  }
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return Response.json(
        { error: 'Analysis failed. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = (data.content || []).map((b) => b.text || '').join('');
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return Response.json({ result: parsed });
  } catch (err) {
    console.error('Analyze error:', err);
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
