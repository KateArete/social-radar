// app/api/analyze/route.js
// ─────────────────────────────────────────────────────────
// Secure proxy: frontend calls this → this calls Anthropic
// API key never leaves the server.
// ─────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '50', 10);
const MAX_INPUT_LENGTH = 5000; // characters
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

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
  if (rateLimitMap.size > 10000) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [k] of rateLimitMap) {
      if (!k.endsWith(today)) rateLimitMap.delete(k);
    }
  }
  return true;
}

// Map common file extensions / MIME types to what Claude expects
function getMediaType(file) {
  const type = file.type?.toLowerCase() || '';
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/png') return 'image/png';
  if (type === 'image/gif') return 'image/gif';
  if (type === 'image/webp') return 'image/webp';
  // Fallback: guess from filename
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const extMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  return extMap[ext] || 'image/png';
}

const SYSTEM_PROMPT = `You are Social Radar, a brutally honest communication analyst. Analyze the provided message (text and/or screenshot) and return ONLY valid JSON. No markdown, no backticks, no preamble.

Return this exact JSON structure:
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
}`;

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

  // ── Parse FormData ──
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid request format' }, { status: 400 });
  }

  const text = formData.get('text')?.toString().trim() || '';
  const imageFile = formData.get('image');

  // Must have at least text or an image
  if (!text && !imageFile) {
    return Response.json({ error: 'Provide a message or upload a screenshot' }, { status: 400 });
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return Response.json(
      { error: `Message too long. Max ${MAX_INPUT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // ── Build the Claude message content array ──
  const contentParts = [];

  // Add image if provided
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_SIZE) {
      return Response.json({ error: 'Image too large. Max 5 MB.' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = getMediaType(imageFile);

    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  }

  // Add text prompt
  const userText = text
    ? `Analyze this message:\n\n"""\n${text}\n"""`
    : 'Analyze the message shown in this screenshot.';

  contentParts.push({ type: 'text', text: userText });

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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: contentParts,
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

    return Response.json(parsed);
  } catch (error) {
    console.error('Analyze error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Server failure' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}