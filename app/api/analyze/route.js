// app/api/analyze/route.js
export const runtime = "nodejs";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

// ---- simple in-memory rate limit ----
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const rl = globalThis.__social_radar_rl || new Map();
globalThis.__social_radar_rl = rl;

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
  const limited = entry.count > RATE_LIMIT_MAX;
  return { limited, remaining, resetAt: entry.resetAt };
}

function json(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
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

export async function POST(req) {
  try {
    // ---- Rate limit ----
    const ip = getClientIp(req);
    const rlRes = rateLimit(ip);
    const rlHeaders = {
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": String(rlRes.remaining),
      "X-RateLimit-Reset": String(Math.floor(rlRes.resetAt / 1000)),
    };
    if (rlRes.limited) {
      return json(429, { error: "Rate limit exceeded. Please wait and try again." }, rlHeaders);
    }

    // ---- Parse multipart ----
    const formData = await req.formData();

    const text = (formData.get("text") || "").toString().trim();

    // IMPORTANT: must be getAll("images") to match frontend fd.append("images", file)
    const rawImages = formData.getAll("images") || [];
    const images = rawImages.filter(Boolean);

    // --- DEBUG (optional): if you want to prove deploy is updated, uncomment next line once ---
    // return json(200, { debug: true, textLen: text.length, imagesCount: images.length }, rlHeaders);

    // ---- Validate ----
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

    // ---- Build multimodal content (ALWAYS include instruction text) ----
    const content = [
      {
        type: "text",
        text:
`You are Social Radar. Analyze the user's message and/or screenshots.

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
      content.push({ type: "text", text: `User text:\n${text}` });
    }

    for (const f of images) {
      const dataUrl = await fileToDataUrl(f);
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const body = {
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return valid JSON only." },
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

    // IMPORTANT: return parsed at TOP LEVEL to match your current frontend setResult(data)
    return json(200, parsed, rlHeaders);
  } catch (e) {
    return json(500, { error: "Server error", details: String(e?.message || e) });
  }
}
