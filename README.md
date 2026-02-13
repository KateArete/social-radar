# 🔥 Social Radar — Deploy Guide

## What you have

A complete Next.js app with:
- Full "Read the Room" analyzer UI
- **Secure API route** (`/api/analyze`) — your Anthropic key stays server-side
- **Rate limiting** — 50 requests/IP/day (configurable)
- **Input validation** — max 5000 chars, rejects empty/bad payloads
- **Shareable result cards** — generates PNG images for social sharing
- **Reply drafter** — 3 suggested responses per analysis
- **PWA support** — installable on phones via "Add to Home Screen"

## Deploy in 10 minutes

### Step 1: Push to GitHub

```bash
# In this folder:
git init
git add .
git commit -m "Initial commit"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/social-radar.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"**
3. Import your `social-radar` repo
4. Framework preset: **Next.js** (auto-detected)
5. Click **Deploy**

It will build and give you a URL like `social-radar-abc.vercel.app`.

### Step 3: Add your API key

1. In Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-...` (your key from [console.anthropic.com](https://console.anthropic.com))
   - **Environment:** Production, Preview, Development
3. Click **Save**
4. Go to **Deployments** → click **⋯** on latest → **Redeploy**

### Step 4: Add your domain (optional)

1. Buy a domain (Namecheap, Cloudflare, etc.)
2. In Vercel → **Settings** → **Domains** → Add your domain
3. Update DNS records as shown (usually just a CNAME to `cname.vercel-dns.com`)
4. HTTPS is automatic

### Step 5: Test it

1. Visit your URL
2. Paste a message → hit Analyze
3. On mobile: tap Share → "Add to Home Screen" to install as PWA
4. Try the share card feature → post to stories

## Project structure

```
social-radar/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.js      ← Secure backend proxy (rate-limited)
│   ├── layout.js              ← HTML shell, fonts, meta tags
│   └── page.js                ← Full UI (client component)
├── public/
│   ├── manifest.json          ← PWA manifest
│   ├── icon-192.png           ← App icon
│   └── icon-512.png           ← App icon (large)
├── .env.local                 ← YOUR API KEY (never commit this!)
├── .gitignore                 ← Ignores .env.local, node_modules, .next
├── next.config.js             ← CORS headers for API route
├── package.json               ← Dependencies
└── README.md                  ← This file
```

## Cost estimate

- **Anthropic API:** ~$0.003 per scan (Claude Sonnet)
  - 1,000 scans ≈ $3
  - 10,000 scans ≈ $30
- **Vercel hosting:** Free tier covers most use cases
- **Domain:** ~$10-12/year

## Customize

- **Rate limit:** Change `RATE_LIMIT_PER_DAY` env var (default: 50/IP/day)
- **Max input length:** Edit `MAX_INPUT_LENGTH` in `app/api/analyze/route.js`
- **Prompt:** Edit the system prompt in the same file to change analysis style
- **Branding:** Edit footer text in the share card canvas code in `page.js`

## Going viral checklist

- [ ] Screen-record analyzing a famous text (celebrity apology, breakup text)
- [ ] Post as TikTok/Reel with hook: "I built an AI that tells you what they ACTUALLY mean"
- [ ] Share result card screenshots on IG stories
- [ ] Add your domain watermark to share cards
- [ ] Post on Product Hunt / Hacker News / Reddit
