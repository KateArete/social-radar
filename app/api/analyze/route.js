// app/api/analyze/route.js
export const runtime = "nodejs"; // needs node for Buffer/base64 reliably

// ---- Config you can control via env ----
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB per image (adjust if you want)
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

// If you are using Vercel AI Gateway, set:
//   AI_BASE_URL=https://ai-gateway.vercel.sh/v1
//   AI_API_KEY=...
// If not using gateway, set OpenAI directly:
//   OPENAI_API_KEY=...
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

// ---- Optional super-simple in-memory rate limit (per server instance) ----
// NOTE: On Vercel serverless this resets often. For real prod, swap to Upstash.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12; // 12 requests/minute per IP
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
  return {
    limited,
    remaining,
    resetAt: entry.resetAt,
  };
}

function json(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function getClientIp(req) {
  // Vercel / proxies
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function fileToDataUrl(file) {
  const ab = await file.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

function isLikelyImage(file) {
  return file && typeof file.type === "string" && file.type.startsWith("image/");
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
      return json(
        429,
        { error: "Rate limit exceeded. Please wait a moment and try again." },
        rlHeaders
      );
    }

    // ---- Parse multipart form ----
    const formData = await req.formData();

    // IMPORTANT: match your frontend keys
    const text = (formData.get("text") || "").toString().trim();

    // ✅ THIS is the fix: getAll("images") not get("image")
    const rawImages = formData.getAll("images") || [];
    const images = rawImages.filter(Boolean);

    // ---- Validate ----
    if (!text && images.length === 0) {
      return json(
        400,
        { error: "Provide a message or upload a screenshot" },
        rlHeaders
      );
    }

    if (images.length > MAX_IMAGES) {
      return json(400, { error: `Max ${MAX_IMAGES} screenshots allowed` }, rlHeaders);
    }

    for (const f of images) {
      // In Next/undici formData, uploaded files come through as File
      if (!(f instanceof File)) {
        return json(400, { error: "Invalid upload. Please upload image files only." }, rlHeaders);
      }
      if (!isLikelyImage(f)) {
        return json(400, { error: "Only image uploads are supported." }, rlHeaders);
      }
      if (typeof f.size === "number" && f.size > MAX_IMAGE_BYTES) {
        return json(
          400,
          { error: `Each image must be under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.` },
          rlHeaders
        );
      }
    }

    if (!AI_API_KEY) {
      return json(
        500,
        { error: "Server is missing AI_API_KEY / OPENAI_API_KEY env var." },
        rlHeaders
      );
    }

    // ---- Build multimodal content ----
    const content = [];

    if (text) {
      content.push({
        type: "text",
        text:
          `You are Social Radar. Analyze the user's message(s) and/or screenshots.\n\n` +
          `Output STRICT JSON with this schema:\n` +
          `{\n` +
          `  "verdict": "green" | "yellow" | "red",\n` +
          `  "summary": string,\n` +
          `  "scores": { "interest": number, "respect": number, "clarity": number, "risk": number, "compatibility": number },\n` +
          `  "signals": string[],\n` +
          `  "what_to_do_next": string[],\n` +
          `  "suggested_reply": string\n` +
          `}\n\n` +
          `User text:\n${text}`
      });
    }

    // add images as data urls
    for (const f of images) {
      const dataUrl = await fileToDataUrl(f);
      content.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    // ---- Call OpenAI-compatible endpoint ----
    // Works for OpenAI direct and many gateways that mimic OpenAI API.
    const body = {
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful analyst. Return valid JSON only. No markdown, no backticks.",
        },
        {
          role: "user",
          content,
        },
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
      return json(
        500,
        {
          error: "AI request failed",
          status: resp.status,
          details: errText?.slice(0, 800) || "",
        },
        rlHeaders
      );
    }

    const data = await resp.json();

    const raw =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";

    // raw should already be JSON (due to response_format), but guard anyway
    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      // If the model returns something weird, still return it for debugging
      return json(
        500,
        { error: "Model returned non-JSON output", raw: String(raw).slice(0, 1500) },
        rlHeaders
      );
    }

    return json(200, { result: parsed }, rlHeaders);
  } catch (e) {
    return json(500, { error: "Server error", details: String(e?.message || e) });
  }
}
