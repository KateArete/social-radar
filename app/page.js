'use client';
import { useState, useRef, useEffect } from 'react';

// ── Constants ──
const EXAMPLES = [
  `Hey! So I've been thinking about what you said last week and honestly I'm not mad or anything lol. I just think maybe we should take some space? Like not a break break, just some breathing room. You're great though seriously. Let me know what you think whenever 💕`,
  `Hi team, just wanted to circle back on the deliverables we discussed. I know everyone's been really busy, but I think we need to be more aligned going forward. I've cc'd leadership so we're all on the same page. Let's sync tomorrow — I've already blocked time on your calendars. Thanks!`,
  `yeah idk maybe we could hang out this weekend? or not, totally up to you. i'm free saturday but also have some stuff i could do so either way is cool. just lmk whenever no pressure haha`,
];

const SCORE_META = [
  { key: 'interest', label: 'Interest', icon: '💘' },
  { key: 'honesty', label: 'Honesty', icon: '🎭' },
  { key: 'power', label: 'Power Play', icon: '👑' },
  { key: 'anxiety', label: 'Anxiety', icon: '⚡' },
  { key: 'manipulation', label: 'Manipulation', icon: '🕸️' },
];

// ── Styles (CSS-in-JS for single-file simplicity) ──
const S = {
  global: `
    :root {
      --bg: #07070d; --surface: rgba(255,255,255,0.025); --border: rgba(255,255,255,0.06);
      --green: #00ffaa; --red: #ff2d55; --amber: #ffb800; --cyan: #00d4ff;
      --text: #dfe0e6; --muted: rgba(255,255,255,0.35);
      --mono: 'IBM Plex Mono', monospace; --display: 'Anybody', sans-serif;
      --serif: 'Source Serif 4', serif; --safe-bottom: env(safe-area-inset-bottom, 0px);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { min-height: 100vh; min-height: 100dvh; background: var(--bg); color: var(--text);
      font-family: var(--serif); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,255,170,0.15); border-radius: 2px; }
    body::before {
      content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background-image:
        radial-gradient(circle at 20% 30%, rgba(0,255,170,0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(255,45,85,0.02) 0%, transparent 50%),
        linear-gradient(rgba(0,255,170,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,170,0.015) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      animation: gridDrift 20s linear infinite;
    }
    @keyframes gridDrift { 0%{background-position:0 0,0 0,0 0,0 0} 100%{background-position:0 0,0 0,32px 32px,32px 32px} }
    @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
    @keyframes scanY { 0%{top:0} 100%{top:100%} }
    textarea::placeholder { color: rgba(255,255,255,0.15) !important; }
    textarea:focus { outline: none; }
  `,
};

// ── Radar Chart SVG ──
function RadarChart({ scores, animate }) {
  const size = 240, cx = size / 2, cy = size / 2, R = 90;
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const r = (v / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const grid = [20, 40, 60, 80, 100].map(v =>
    SCORE_META.map((_, i) => pt(i, v).join(',')).join(' ')
  );
  const data = SCORE_META.map((m, i) => pt(i, scores[m.key] || 0));
  const poly = data.map(p => p.join(',')).join(' ');

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 240 }}>
        {grid.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="rgba(0,255,170,0.06)" strokeWidth="1" />
        ))}
        {SCORE_META.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(0,255,170,0.08)" strokeWidth="1" />;
        })}
        <polygon points={poly} fill="rgba(0,255,170,0.12)" stroke="var(--green)" strokeWidth="1.5"
          style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.8s ease 0.3s' }} />
        {data.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="var(--green)"
            style={{ opacity: animate ? 1 : 0, transition: `opacity 0.4s ease ${0.5 + i * 0.1}s` }} />
        ))}
        {SCORE_META.map((m, i) => {
          const [x, y] = pt(i, 122);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fill="var(--muted)" fontSize="10" fontFamily="var(--mono)">{m.icon}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Score Bar ──
function ScoreBar({ meta, value, delay, show }) {
  const level = value > 70 ? 'high' : value > 40 ? 'mid' : 'low';
  const color = value > 70 ? 'var(--red)' : value > 40 ? 'var(--amber)' : 'var(--green)';
  const gradient = value > 70
    ? 'linear-gradient(90deg, var(--red), #ff6644)'
    : value > 40
    ? 'linear-gradient(90deg, var(--amber), #ffcc33)'
    : 'linear-gradient(90deg, var(--green), #00ddaa)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: show ? 1 : 0, transform: show ? 'translateX(0)' : 'translateX(-12px)',
      transition: `all 0.4s ease ${delay}s`,
    }}>
      <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
      <span style={{ font: '400 11px/1 var(--mono)', color: 'var(--muted)', width: 88, flexShrink: 0 }}>{meta.label}</span>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: gradient,
          width: show ? `${value}%` : '0%',
          transition: `width 1s cubic-bezier(0.25,0.46,0.45,0.94) ${delay + 0.2}s`,
        }} />
      </div>
      <span style={{
        font: '700 12px/1 var(--mono)', width: 30, textAlign: 'right', color,
        opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${delay + 0.6}s`,
      }}>{value}</span>
    </div>
  );
}

// ── Main App ──
export default function SocialRadar() {
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState(null);
  const [copiedReply, setCopiedReply] = useState(null);
  const [shareImg, setShareImg] = useState(null);
  const textareaRef = useRef(null);
  const canvasRef = useRef(null);

  const analyze = async () => {
    if (!input.trim() || scanning) return;
    setScanning(true); setResult(null); setShowResult(false); setError(null); setShareImg(null);

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data.result);
      setTimeout(() => setShowResult(true), 200);
    } catch (e) {
      setError(e.message || 'Signal lost. Try again.');
    } finally {
      setScanning(false);
    }
  };

  const copyReply = (type, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReply(type);
      setTimeout(() => setCopiedReply(null), 1500);
    });
  };

  const generateShareCard = () => {
    if (!result) return;
    const r = result;
    const canvas = canvasRef.current;
    const W = 720, H = 960;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#07070d'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,255,170,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const grd = ctx.createRadialGradient(200, 300, 0, 200, 300, 350);
    grd.addColorStop(0, 'rgba(0,255,170,0.04)'); grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = '#fff'; ctx.font = '900 48px Anybody, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Social Radar', W / 2, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '500 12px IBM Plex Mono, monospace';
    ctx.fillText('SIGNAL ANALYSIS REPORT', W / 2, 96);

    // Verdict
    const vColor = r.verdict.includes('RED') ? '#ff2d55' : r.verdict.includes('GREEN') ? '#00ffaa' : '#ffb800';
    ctx.font = '48px sans-serif'; ctx.fillText(r.verdict_emoji || '🟡', W / 2, 160);
    ctx.fillStyle = vColor; ctx.font = '900 24px Anybody, sans-serif'; ctx.fillText(r.verdict, W / 2, 198);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(60, 225); ctx.lineTo(W - 60, 225); ctx.stroke();

    // Translation
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,255,170,0.4)';
    ctx.font = '500 10px IBM Plex Mono, monospace'; ctx.fillText('◈ DECODED TRANSLATION', 60, 260);
    ctx.fillStyle = '#fff'; ctx.font = 'italic 700 20px Source Serif 4, serif';
    wrapText(ctx, `"${r.translation}"`, 60, 292, W - 120, 28);

    // Scores
    const sy = 420;
    ctx.fillStyle = 'rgba(0,212,255,0.4)'; ctx.font = '500 10px IBM Plex Mono, monospace';
    ctx.fillText('◉ SIGNAL LEVELS', 60, sy);
    SCORE_META.forEach((m, i) => {
      const y = sy + 30 + i * 36; const val = r.scores[m.key] || 0;
      const col = val > 70 ? '#ff2d55' : val > 40 ? '#ffb800' : '#00ffaa';
      ctx.font = '16px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.fillText(m.icon, 60, y);
      ctx.font = '400 12px IBM Plex Mono, monospace'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(m.label, 90, y);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; roundRect(ctx, 210, y - 8, 400, 8, 4); ctx.fill();
      ctx.fillStyle = col; roundRect(ctx, 210, y - 8, 400 * (val / 100), 8, 4); ctx.fill();
      ctx.font = '700 13px IBM Plex Mono, monospace'; ctx.fillStyle = col;
      ctx.textAlign = 'right'; ctx.fillText(String(val), W - 60, y); ctx.textAlign = 'left';
    });

    // Flags
    const fy = sy + 220;
    ctx.fillStyle = 'rgba(255,45,85,0.5)'; ctx.font = '500 10px IBM Plex Mono, monospace';
    ctx.fillText('🚩 RED FLAGS', 60, fy);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 13px Source Serif 4, serif';
    (r.red_flags || []).slice(0, 3).forEach((f, i) => ctx.fillText('• ' + f, 60, fy + 22 + i * 22));
    ctx.fillStyle = 'rgba(0,255,170,0.5)'; ctx.font = '500 10px IBM Plex Mono, monospace';
    ctx.fillText('✅ GREEN FLAGS', W / 2 + 20, fy);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 13px Source Serif 4, serif';
    (r.green_flags || []).slice(0, 3).forEach((f, i) => ctx.fillText('• ' + f, W / 2 + 20, fy + 22 + i * 22));

    // Footer
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '400 11px IBM Plex Mono, monospace';
    ctx.fillText('socialradar.app  •  What are they actually thinking?', W / 2, H - 30);

    const dataUrl = canvas.toDataURL('image/png');
    setShareImg(dataUrl);

    // Try native share
    canvas.toBlob(async (blob) => {
      try {
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'social-radar.png', { type: 'image/png' });
          const shareData = { files: [file], title: 'Social Radar', text: `${r.verdict_emoji} ${r.verdict}` };
          if (navigator.canShare(shareData)) { await navigator.share(shareData); return; }
        }
      } catch {}
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'social-radar-result.png'; a.click();
    }, 'image/png');
  };

  const reset = () => {
    setInput(''); setResult(null); setShowResult(false); setError(null); setShareImg(null);
    textareaRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const verdictColor = result?.verdict?.includes('RED') ? 'var(--red)'
    : result?.verdict?.includes('GREEN') ? 'var(--green)' : 'var(--amber)';
  const verdictBg = result?.verdict?.includes('RED') ? 'rgba(255,45,85,0.06)'
    : result?.verdict?.includes('GREEN') ? 'rgba(0,255,170,0.05)' : 'rgba(255,184,0,0.05)';
  const verdictBorder = result?.verdict?.includes('RED') ? 'rgba(255,45,85,0.15)'
    : result?.verdict?.includes('GREEN') ? 'rgba(0,255,170,0.15)' : 'rgba(255,184,0,0.15)';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: S.global }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px calc(24px + var(--safe-bottom))', position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,255,170,0.06)', border: '1px solid rgba(0,255,170,0.12)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 16,
            font: '500 10px/1 var(--mono)', color: 'var(--green)', letterSpacing: 2.5, textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease infinite' }} />
            SIGNAL ACTIVE
          </div>
          <h1 style={{
            font: '900 clamp(40px,10vw,52px)/1 var(--display)', letterSpacing: -2, marginBottom: 6,
            background: 'linear-gradient(135deg, #fff 20%, var(--green) 60%, var(--cyan) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Social Radar</h1>
          <p style={{ font: '400 12px/1 var(--mono)', color: 'var(--muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            decode what they actually mean
          </p>
        </div>

        {/* ── Input ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, position: 'relative', marginBottom: 12,
        }}>
          {scanning && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14, pointerEvents: 'none' }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, var(--green), transparent)',
                animation: 'scanY 1.8s ease-in-out infinite',
              }} />
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste a text, email, DM, work message…"
            rows={4}
            maxLength={5000}
            style={{
              width: '100%', minHeight: 110, padding: '18px 20px',
              background: 'none', border: 'none', color: 'var(--text)',
              font: '400 15px/1.7 var(--serif)', resize: 'vertical', outline: 'none',
            }}
          />
          <div style={{ position: 'absolute', bottom: 8, right: 14, font: '400 10px/1 var(--mono)', color: 'rgba(255,255,255,0.12)' }}>
            {input.length}
          </div>
        </div>

        {/* ── Examples ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <span style={{ font: '400 10px/1 var(--mono)', color: 'var(--muted)', letterSpacing: 1 }}>TRY:</span>
          {['💔 Soft Breakup', '💼 Toxic Boss', '😬 Anxious Text'].map((label, i) => (
            <button key={i} onClick={() => { setInput(EXAMPLES[i]); textareaRef.current?.focus(); }}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 100, padding: '6px 12px', font: '400 11px/1 var(--mono)',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{label}</button>
          ))}
        </div>

        {/* ── CTA ── */}
        <button onClick={analyze} disabled={!input.trim() || scanning}
          style={{
            width: '100%', padding: 16, border: 'none', borderRadius: 12,
            font: '700 13px/1 var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
            cursor: input.trim() && !scanning ? 'pointer' : 'default', marginBottom: 28,
            background: scanning ? 'rgba(0,255,170,0.08)' : input.trim() ? 'linear-gradient(135deg, var(--green), #00cc88)' : 'rgba(255,255,255,0.04)',
            color: scanning ? 'var(--green)' : input.trim() ? '#070a0d' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s',
          }}>
          {scanning ? '◎ SCANNING SIGNAL…' : '⎊ ANALYZE MESSAGE'}
        </button>

        {/* ── Error ── */}
        {error && (
          <div style={{ textAlign: 'center', font: '400 13px/1 var(--mono)', color: 'var(--red)', padding: 16 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Verdict */}
            <div style={{
              textAlign: 'center', padding: '28px 20px', borderRadius: 14,
              background: verdictBg, border: `1px solid ${verdictBorder}`,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease',
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{result.verdict_emoji}</div>
              <div style={{ font: '900 20px/1 var(--display)', letterSpacing: 3, color: verdictColor }}>{result.verdict}</div>
            </div>

            {/* Translation */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.1s',
            }}>
              <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(0,255,170,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                ◈ DECODED TRANSLATION
              </div>
              <p style={{ font: 'italic 700 18px/1.55 var(--serif)', color: '#fff', margin: 0 }}>"{result.translation}"</p>
              <div style={{
                marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.025)', borderRadius: 8,
                font: '400 12px/1.4 var(--mono)', color: 'rgba(255,255,255,0.45)',
              }}>HIDDEN TONE: {result.hidden_tone}</div>
            </div>

            {/* Radar + Scores */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.2s',
            }}>
              <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(0,212,255,0.5)', letterSpacing: 2, marginBottom: 12 }}>
                ◉ SIGNAL ANALYSIS
              </div>
              <RadarChart scores={result.scores} animate={showResult} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {SCORE_META.map((m, i) => (
                  <ScoreBar key={m.key} meta={m} value={result.scores[m.key] || 0} delay={0.3 + i * 0.1} show={showResult} />
                ))}
              </div>
            </div>

            {/* Flags */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { flags: result.red_flags, label: '🚩 RED FLAGS', color: 'var(--red)', bg: 'rgba(255,45,85,0.04)', border: 'rgba(255,45,85,0.1)' },
                { flags: result.green_flags, label: '✅ GREEN FLAGS', color: 'var(--green)', bg: 'rgba(0,255,170,0.04)', border: 'rgba(0,255,170,0.1)' },
              ].map((group, gi) => (
                <div key={gi} style={{
                  background: group.bg, border: `1px solid ${group.border}`, borderRadius: 14, padding: 16,
                  opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
                  transition: `all 0.5s ease ${0.3 + gi * 0.08}s`,
                }}>
                  <div style={{ font: '500 10px/1 var(--mono)', color: group.color, letterSpacing: 2, marginBottom: 12 }}>{group.label}</div>
                  {(!group.flags || group.flags.length === 0) ? (
                    <div style={{ font: '400 13px/1.5 var(--serif)', color: 'var(--muted)' }}>None detected</div>
                  ) : group.flags.map((f, i) => (
                    <div key={i} style={{
                      font: '400 13px/1.5 var(--serif)', color: 'rgba(255,255,255,0.65)', padding: '5px 0',
                      borderBottom: i < group.flags.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    }}>{f}</div>
                  ))}
                </div>
              ))}
            </div>

            {/* Power + Advice */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.4s',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(255,184,0,0.6)', letterSpacing: 2, marginBottom: 8 }}>👑 POWER DYNAMIC</div>
                  <p style={{ font: '400 13px/1.6 var(--serif)', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{result.power_dynamic}</p>
                </div>
                <div>
                  <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(0,212,255,0.6)', letterSpacing: 2, marginBottom: 8 }}>💡 YOUR MOVE</div>
                  <p style={{ font: '400 13px/1.6 var(--serif)', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{result.advice}</p>
                </div>
              </div>
            </div>

            {/* Reply Drafter */}
            {result.replies && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
                opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
                transition: 'all 0.5s ease 0.5s',
              }}>
                <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 14 }}>
                  ✍️ SUGGESTED REPLIES — TAP TO COPY
                </div>
                {[
                  { type: 'assertive', tag: '🔥 ASSERTIVE', color: 'var(--red)' },
                  { type: 'chill', tag: '😎 CHILL', color: 'var(--green)' },
                  { type: 'mirror', tag: '🪞 MIRROR ENERGY', color: 'var(--amber)' },
                ].map(({ type, tag, color }) => result.replies[type] ? (
                  <div key={type} onClick={() => copyReply(type, result.replies[type])}
                    style={{
                      padding: '14px 16px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      border: copiedReply === type ? `1px solid var(--green)` : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s', position: 'relative',
                    }}>
                    <div style={{ font: '700 10px/1 var(--mono)', letterSpacing: 1.5, color, marginBottom: 6 }}>{tag}</div>
                    <div style={{ font: '400 14px/1.6 var(--serif)', color: 'rgba(255,255,255,0.75)' }}>{result.replies[type]}</div>
                    {copiedReply === type && (
                      <span style={{ position: 'absolute', top: 10, right: 12, font: '500 10px/1 var(--mono)', color: 'var(--green)' }}>COPIED ✓</span>
                    )}
                  </div>
                ) : null)}
              </div>
            )}

            {/* Share + Reset */}
            <div style={{ textAlign: 'center', paddingTop: 4, paddingBottom: 32 }}>
              <button onClick={generateShareCard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 100, padding: '10px 22px',
                  font: '500 12px/1 var(--mono)', color: 'var(--muted)', cursor: 'pointer', letterSpacing: 1,
                }}>📤 SHARE RESULT CARD</button>
              {shareImg && (
                <div style={{ marginTop: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={shareImg} alt="Share card" style={{ width: '100%', display: 'block' }} />
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <button onClick={reset}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 100, padding: '10px 20px',
                    font: '400 11px/1 var(--mono)', color: 'var(--muted)', cursor: 'pointer', letterSpacing: 1,
                  }}>↺ SCAN ANOTHER</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Canvas helpers ──
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y); line = word + ' '; y += lineH;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
