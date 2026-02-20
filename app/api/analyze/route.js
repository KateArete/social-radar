// app/api/analyze/route.js
export const runtime = "nodejs";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

// ── Rate limiting: per-minute burst protection ──
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5; // max 5 requests per minute per IP (down from 12)

// ── Daily cap: hard limit per IP per day to protect costs ──
const DAILY_CAP_MAX = 10; // max 10 requests per IP per day (free users get 3+1 via client, this is server-side safety net)
const DAY_MS = 24 * 60 * 60 * 1000;

const rl = globalThis.__social_radar_rl || new Map();
const daily = globalThis.__social_radar_daily || new Map();
globalThis.__social_radar_rl = rl;
globalThis.__social_radar_daily = daily;

function rateLimit(ip) {
  const now = Date.now();
  const entry = rl.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  rl.set(ip, entry);
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return { limited: entry.count > RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt };
}

function dailyLimit(ip) {
  const now = Date.now();
  const today = new Date().toDateString();
  const entry = daily.get(ip) || { count: 0, date: today };
  if (entry.date !== today) {
    entry.count = 0;
    entry.date = today;
  }
  entry.count += 1;
  daily.set(ip, entry);
  return { limited: entry.count > DAILY_CAP_MAX, count: entry.count };
}

// ── Cleanup old entries every hour to prevent memory leak ──
if (!globalThis.__social_radar_cleanup) {
  globalThis.__social_radar_cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rl.entries()) {
      if (now > entry.resetAt) rl.delete(ip);
    }
  }, 60 * 60 * 1000);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function getClientIp(req) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isLikelyImage(file) {
  return file && typeof file.type === "string" && file.type.startsWith("image/");
}

async function fileToDataUrl(file) {
  const ab = await file.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

const SYSTEM_PROMPT = `You are SOCIAL RADAR — a brutally honest communication analyst who decodes the REAL meaning behind messages.

Your job is NOT to rewrite or paraphrase the message. Your job is to EXPOSE what the sender is actually thinking, feeling, and trying to accomplish beneath their words.

## DECODED TRANSLATION RULES (MOST IMPORTANT)
The "translation" field is the core of Social Radar. It must:
- Be written in FIRST PERSON from the sender's perspective — as if they dropped all filters and said what they actually meant
- Be raw, blunt, and unfiltered — strip away all politeness, corporate speak, hedging, and emotional padding
- Reveal hidden motives, insecurities, power plays, guilt trips, or anxieties the sender would never say out loud
- Feel like reading someone's inner monologue — the ugly truth behind the nice words
- NEVER just rephrase or clean up the original message — that defeats the entire purpose

### Examples of GOOD translations:
- Original: "Hey, just checking in! Haven't heard from you in a while 💕"
  Translation: "I'm spiraling because you haven't texted me back and I need reassurance that you still care about me, but I'm pretending to be casual about it."

- Original: "I've cc'd leadership so we're all on the same page"
  Translation: "I'm tattling to your boss because I want you to know I have leverage over you. This is a threat disguised as teamwork."

- Original: "No worries if not!"
  Translation: "There will absolutely be worries. I'll hold this against you, but I want to seem easygoing."

### Examples of BAD translations (DO NOT DO THIS):
- Just rewording: "I wanted to follow up on our discussion" ← This is NOT decoding
- Being too neutral: "The sender seems to want alignment" ← Too soft, too analytical
- Summarizing: "They are requesting a meeting" ← This is a summary, not a decode

## HIDDEN TONE
Be specific and cutting. Not just "frustrated" — say "passive-aggressive with a side of insecurity" or "fake-cheerful masking deep resentment." Be colorful and precise.

## SCORES (0-100)
- interest: How emotionally invested is the sender? Low = checked out, high = deeply invested
- honesty: How filtered is this message? Low = heavily performing/masking, high = genuine
- power: How much is the sender trying to control the dynamic? Low = equal footing, high = dominance play
- anxiety: How much nervous energy is underneath? Low = calm, high = spiraling
- manipulation: Is the sender trying to engineer a specific response? Low = straightforward, high = calculated

## RED FLAGS & GREEN FLAGS
Be specific, not generic. Instead of "passive aggressive tone," say "Using 'just wanted to' to disguise a demand as a casual ask." Pull exact patterns from the message.

## POWER DYNAMIC
Who holds the power and how is it being wielded? Be specific about the tactics.

## ADVICE
Give the reader practical, direct advice about how to respond. Be their savvy friend, not a therapist.

## REPLIES
- assertive: Direct, confident, takes back power. No aggression, just clarity.
- chill: Casual, unbothered energy. Shows you're not rattled.
- mirror: Matches the sender's exact energy and tactics back at them.

Return STRICT JSON only. No markdown, no backticks, no explanation outside the JSON.`;

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // ── Per-minute burst check ──
    const rlRes = rateLimit(ip);
    const rlHeaders = {
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": String(rlRes.remaining),
      "X-RateLimit-Reset": String(Math.floor(rlRes.resetAt / 1000)),
    };
    if (rlRes.limited) {
      return json(429, { error: "Too many requests. Please slow down." }, rlHeaders);
    }

    // ── Daily cap check ──
    const dailyRes = dailyLimit(ip);
    if (dailyRes.limited) {
      return json(429, {
        error: "Daily limit reached. Upgrade to Pro for unlimited scans.",
        daily: true,
      }, rlHeaders);
    }

    // ── Parse multipart ──
    const formData = await req.formData();
    const text = (formData.get("text") || "").toString().trim();
    const rawImages = formData.getAll("images") || [];
    const images = rawImages.filter(Boolean);

    // ── Validate ──
    if (!text && images.length === 0) {
      return json(400, { error: "Provide a message or upload a screenshot" }, rlHeaders);
    }
    if (images.length > MAX_IMAGES) {
      return json(400, { error: `Max ${MAX_IMAGES} screenshots allowed` }, rlHeaders);
    }
    for (const f of images) {
      if (!(f instanceof File)) {
        return json(400, { error: "Invalid upload. Please upload image files only." }, rlHeaders);
      }
      if (!isLikelyImage(f)) {
        return json(400, { error: "Only image uploads are supported." }, rlHeaders);
      }
      if (typeof f.size === "number" && f.size > MAX_IMAGE_BYTES) {
        return json(400, { error: `Each image must be under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.` }, rlHeaders);
      }
    }
    if (!AI_API_KEY) {
      return json(500, { error: "Server is missing AI_API_KEY / OPENAI_API_KEY env var." }, rlHeaders);
    }

    // ── Build multimodal content ──
    const content = [
      {
        type: "text",
        text:
`Analyze the following message/screenshot. Decode what the sender ACTUALLY means — their real thoughts, motives, and feelings they'd never say out loud. Write the translation in first person as the sender's unfiltered inner monologue.

Return STRICT JSON with this schema (no markdown, no backticks):

{
  "verdict": "GREEN LIGHT" | "YELLOW LIGHT" | "RED LIGHT",
  "verdict_emoji": "🟢" | "🟡" | "🔴",
  "translation": string,
  "hidden_tone": string,
  "scores": { "interest": number, "honesty": number, "power": number, "anxiety": number, "manipulation": number },
  "red_flags": string[],
  "green_flags": string[],
  "power_dynamic": string,
  "advice": string,
  "replies": { "assertive": string, "chill": string, "mirror": string }
}

If no text is provided, infer from the screenshots.
If a score is unknown, still output a number 0-100.`
      }
    ];

    if (text) {
      content.push({ type: "text", text: `Message to decode:\n${text}` });
    }
    for (const f of images) {
      const dataUrl = await fileToDataUrl(f);
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const body = {
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    };

    const resp = await fetch(`${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json(500, { error: "AI request failed", status: resp.status, details: errText.slice(0, 800) }, rlHeaders);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return json(500, { error: "Model returned non-JSON output", raw: String(raw).slice(0, 1500) }, rlHeaders);
    }

    return json(200, parsed, rlHeaders);
  } catch (e) {
    return json(500, { error: "Server error", details: String(e?.message || e) });
  }
}