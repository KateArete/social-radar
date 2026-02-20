'use client';
// ═══ SOCIAL RADAR v2.4 — WITH REVENUECAT PAYWALL ═══
import { useState, useRef, useEffect } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const RC_API_KEY = "goog_HxvgYKRXpUmUrZOKfkhpZYijRan";
const ENTITLEMENT_ID = "Social Radar Pro";
const FREE_DAILY_TEXTS = 3;
const FREE_DAILY_IMAGES = 1;

// ── Constants ──
const EXAMPLES = [
  `Hey! So I've been thinking about what you said last week and honestly I'm not mad or anything lol. I just think maybe we should take some space? Like not a break break, just some breathing room. You're great though seriously. Let me know what you think whenever 💕`,
  `Per my last email, nobody has followed up on what we discussed. I shouldn't have to chase people down. I've looped in leadership since clearly we need more accountability here. I blocked time on your calendars for tomorrow morning — attendance is mandatory. We need to get serious.`,
  `yeah idk maybe we could hang out this weekend? or not, totally up to you. i'm free saturday but also have some stuff i could do so either way is cool. just lmk whenever no pressure haha`,
];

const SCORE_META = [
  { key: 'interest', label: 'Interest', icon: '💘',
    tips: { low: 'Low investment — they\'re keeping emotional distance.', mid: 'Moderate interest — engaged but holding back.', high: 'High interest — they\'re emotionally invested in this.' } },
  { key: 'honesty', label: 'Honesty', icon: '🎭',
    tips: { low: 'Heavily filtered — what you see isn\'t what they mean.', mid: 'Partially honest — truth mixed with strategic framing.', high: 'High authenticity — saying what they actually feel.' } },
  { key: 'power', label: 'Power Play', icon: '👑',
    tips: { low: 'Minimal power plays — meeting you at eye level.', mid: 'Some leverage — controlling pace or framing.', high: 'High leverage — sender controls the interaction dynamics.' } },
  { key: 'anxiety', label: 'Anxiety', icon: '⚡',
    tips: { low: 'Calm and composed — no nervous energy detected.', mid: 'Some tension — hedging or over-explaining.', high: 'High anxiety — overcompensating, softening, or deflecting.' } },
  { key: 'manipulation', label: 'Manipulation', icon: '🕸️',
    tips: { low: 'Straightforward — no hidden agenda detected.', mid: 'Some strategic framing — calculated but not malicious.', high: 'Manipulation detected — guilt-shifting, gaslighting, or pressure.' } },
];

function scoreColor(value) {
  return value > 70 ? 'var(--red)' : value > 40 ? 'var(--amber)' : 'var(--green)';
}
function scoreColorRaw(value) {
  return value > 70 ? '#ff2d55' : value > 40 ? '#ffb800' : '#00ffaa';
}
function scoreTip(meta, value) {
  const level = value > 70 ? 'high' : value > 40 ? 'mid' : 'low';
  return meta.tips?.[level] || '';
}

// ── Styles ──
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
    @keyframes shareGlow {
      0%,100% { box-shadow: 0 0 16px rgba(0,255,170,0.15), 0 0 40px rgba(0,255,170,0.06); }
      50% { box-shadow: 0 0 24px rgba(0,255,170,0.3), 0 0 60px rgba(0,255,170,0.1); }
    }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes hintFloat {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes paywallIn {
      from { opacity: 0; transform: translateY(100%); }
      to { opacity: 1; transform: translateY(0); }
    }
    textarea::placeholder { color: rgba(255,255,255,0.15) !important; }
    textarea:focus { outline: none; }
  `,
};

// ── Paywall Modal ──
function PaywallModal({ offerings, onPurchase, onRestore, onDismiss, purchasing, restoring, purchaseError }) {
  // RC uses $rc_monthly and $rc_annual as package identifiers
  const monthly = offerings?.current?.availablePackages?.find(p => p.packageType === 'MONTHLY') 
    || offerings?.current?.availablePackages?.find(p => p.identifier === '$rc_monthly');
  const annual = offerings?.current?.availablePackages?.find(p => p.packageType === 'ANNUAL')
    || offerings?.current?.availablePackages?.find(p => p.identifier === '$rc_annual');
  const [selected, setSelected] = useState('monthly');

  const selectedPkg = selected === 'monthly' ? monthly : annual;

  const monthlyPrice = monthly?.product?.priceString || '$9.99/mo';
  const annualPrice = annual?.product?.priceString || '$79.99/yr';
  const annualMonthly = annual?.product?.price
    ? `$${(annual.product.price / 12).toFixed(2)}/mo`
    : '$6.67/mo';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        width: '100%', maxHeight: '90vh', overflowY: 'auto',
        background: '#0d0d1a',
        border: '1px solid rgba(0,255,170,0.12)',
        borderRadius: '24px 24px 0 0',
        padding: '32px 24px calc(32px + var(--safe-bottom))',
        animation: 'paywallIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Close button */}
        <button onClick={onDismiss} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          borderRadius: '50%', width: 32, height: 32,
          color: 'var(--muted)', font: '400 16px/1 var(--mono)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
          <h2 style={{
            font: '900 28px/1.1 var(--display)', letterSpacing: -1,
            background: 'linear-gradient(135deg, #fff 20%, var(--green) 60%, var(--cyan) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 8,
          }}>Unlock Social Radar Pro</h2>
          <p style={{ font: '400 14px/1.5 var(--serif)', color: 'var(--muted)' }}>
            See what they actually mean.<br />Decode patterns. Respond with confidence.
          </p>
        </div>

        {/* Features */}
        {[
          ['⚡', 'Unlimited Message & Screenshot Scans'],
          ['🧠', 'Deep Psychological Pattern Detection'],
          ['👑', 'Pro Verdict & Strategy Breakdown'],
          ['✍️', 'AI-Powered Reply Suggestions'],
          ['📤', 'Shareable Results Cards'],
        ].map(([icon, text]) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>
            <span style={{ font: '400 14px/1 var(--serif)', color: 'rgba(255,255,255,0.75)' }}>{text}</span>
          </div>
        ))}

        {/* Plan selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '24px 0 20px' }}>
          {/* Monthly */}
          <div onClick={() => setSelected('monthly')} style={{
            padding: '16px 14px', borderRadius: 14, cursor: 'pointer',
            background: selected === 'monthly' ? 'rgba(0,255,170,0.07)' : 'rgba(255,255,255,0.03)',
            border: selected === 'monthly' ? '2px solid rgba(0,255,170,0.4)' : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}>
            <div style={{ font: '700 11px/1 var(--mono)', color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>MONTHLY</div>
            <div style={{ font: '900 20px/1 var(--display)', color: '#fff' }}>{monthlyPrice}</div>
            <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--muted)', marginTop: 4 }}>billed monthly</div>
          </div>

          {/* Annual */}
          <div onClick={() => setSelected('annual')} style={{
            padding: '16px 14px', borderRadius: 14, cursor: 'pointer', position: 'relative',
            background: selected === 'annual' ? 'rgba(0,255,170,0.07)' : 'rgba(255,255,255,0.03)',
            border: selected === 'annual' ? '2px solid rgba(0,255,170,0.4)' : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: -10, right: 10,
              background: 'var(--green)', color: '#070a0d',
              font: '700 9px/1 var(--mono)', letterSpacing: 1,
              padding: '3px 8px', borderRadius: 100,
            }}>BEST VALUE</div>
            <div style={{ font: '700 11px/1 var(--mono)', color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>ANNUAL</div>
            <div style={{ font: '900 20px/1 var(--display)', color: '#fff' }}>{annualMonthly}</div>
            <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--muted)', marginTop: 4 }}>{annualPrice} billed yearly</div>
          </div>
        </div>

        {/* Error */}
        {purchaseError && (
          <div style={{
            font: '400 12px/1.4 var(--mono)', color: 'var(--red)',
            textAlign: 'center', marginBottom: 12,
          }}>⚠ {purchaseError}</div>
        )}

        {/* CTA */}
        <button
          onClick={() => selectedPkg && onPurchase(selectedPkg)}
          disabled={purchasing || !selectedPkg}
          style={{
            width: '100%', padding: 18, border: 'none', borderRadius: 14,
            font: '700 13px/1 var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
            cursor: purchasing ? 'default' : 'pointer',
            background: purchasing ? 'rgba(0,255,170,0.1)' : 'linear-gradient(135deg, var(--green), #00cc88)',
            color: purchasing ? 'var(--green)' : '#070a0d',
            transition: 'all 0.3s', marginBottom: 14,
          }}>
          {purchasing ? '◎ PROCESSING…' : `⎊ START PRO — ${selected === 'monthly' ? monthlyPrice : annualPrice}`}
        </button>

        {/* Restore */}
        <button onClick={onRestore} disabled={restoring} style={{
          width: '100%', padding: 12, background: 'none',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
          font: '400 12px/1 var(--mono)', color: 'var(--muted)', cursor: 'pointer',
          transition: 'all 0.2s', marginBottom: 16,
        }}>
          {restoring ? 'Restoring…' : '↺ Restore Purchases'}
        </button>

        <div style={{ font: '400 10px/1.5 var(--mono)', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
          Subscriptions auto-renew. Cancel anytime in Google Play.
        </div>
      </div>
    </div>
  );
}

// ── Radar Chart SVG ──
function RadarChart({ scores, animate }) {
  const [activeTip, setActiveTip] = useState(null);
  const size = 280, cx = size / 2, cy = size / 2, R = 105;
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
  const tipMeta = activeTip !== null ? SCORE_META[activeTip] : null;
  const tipVal = tipMeta ? (scores[tipMeta.key] || 0) : 0;
  const tipColor = scoreColorRaw(tipVal);
  const tipText = tipMeta ? scoreTip(tipMeta, tipVal) : '';

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 4px',
      transform: animate ? 'scale(1) rotate(0deg)' : 'scale(0.6) rotate(-10deg)',
      opacity: animate ? 1 : 0,
      transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 280 }}
        onMouseLeave={() => setActiveTip(null)}>
        {grid.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {SCORE_META.map((m, i) => {
          const [x, y] = pt(i, 100);
          const col = scoreColorRaw(scores[m.key] || 0);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={col} strokeWidth="1" strokeOpacity="0.15" />;
        })}
        {SCORE_META.map((m, i) => {
          const val = scores[m.key] || 0;
          const next = (i + 1) % 5;
          const valNext = scores[SCORE_META[next].key] || 0;
          const [x1, y1] = pt(i, val);
          const [x2, y2] = pt(next, valNext);
          const col = scoreColorRaw(val);
          return (
            <polygon key={`seg-${i}`} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
              fill={col} fillOpacity={animate ? 0.07 : 0}
              style={{ transition: `fill-opacity 0.8s ease ${0.5 + i * 0.08}s` }} />
          );
        })}
        <polygon points={poly} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3"
          style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.8s ease 0.5s' }} />
        {data.map(([x, y], i) => {
          const val = scores[SCORE_META[i].key] || 0;
          const col = scoreColorRaw(val);
          return (
            <g key={i} style={{ opacity: animate ? 1 : 0, transition: `opacity 0.4s ease ${0.7 + i * 0.1}s` }}>
              <circle cx={x} cy={y} r="8" fill={col} fillOpacity="0.1" />
              <circle cx={x} cy={y} r="4.5" fill={col} stroke={col} strokeWidth="1" strokeOpacity="0.3" />
            </g>
          );
        })}
        {data.map(([x, y], i) => (
          <circle key={`hit-${i}`} cx={x} cy={y} r="22" fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setActiveTip(i)}
            onTouchStart={(e) => { e.preventDefault(); setActiveTip(activeTip === i ? null : i); }}
          />
        ))}
        {SCORE_META.map((m, i) => {
          const [x, y] = pt(i, 128);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fill="var(--muted)" fontSize="14" fontFamily="var(--mono)">{m.icon}</text>
          );
        })}
        {SCORE_META.map((m, i) => {
          const val = scores[m.key] || 0;
          const col = scoreColorRaw(val);
          const [x, y] = pt(i, 118);
          const offsetY = i === 0 ? -13 : (i === 2 || i === 3) ? 13 : 0;
          const offsetX = (i === 1 || i === 2) ? 15 : (i === 3 || i === 4) ? -15 : 0;
          return (
            <text key={`val-${i}`} x={x + offsetX} y={y + offsetY} textAnchor="middle" dominantBaseline="middle"
              fill={col} fontSize="9" fontFamily="var(--mono)" fontWeight="700" opacity="0.6">{val}</text>
          );
        })}
      </svg>
      {!activeTip && activeTip !== 0 && (
        <div style={{ font: '400 10px/1 var(--mono)', color: 'rgba(255,255,255,0.15)', letterSpacing: 1, marginTop: 4, textAlign: 'center' }}>
          TAP EACH POINT TO EXPLORE
        </div>
      )}
      {activeTip !== null && tipMeta && (
        <div style={{
          marginTop: 8, width: '100%', maxWidth: 280,
          background: 'rgba(7,7,13,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '12px 14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{tipMeta.icon}</span>
            <span style={{ font: '700 12px/1 var(--mono)', color: tipColor }}>{tipMeta.label}</span>
            <span style={{ font: '900 12px/1 var(--mono)', color: tipColor, marginLeft: 'auto' }}>{tipVal}<span style={{ opacity: 0.4, fontWeight: 400 }}>/100</span></span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, width: `${tipVal}%`, background: tipColor, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ font: '400 11px/1.45 var(--serif)', color: 'rgba(255,255,255,0.55)' }}>{tipText}</div>
        </div>
      )}
    </div>
  );
}

// ── Score Bar ──
function ScoreBar({ meta, value, delay, show }) {
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
  const [uploadedImages, setUploadedImages] = useState([]);
  const [copiedReply, setCopiedReply] = useState(null);
  const [shareImg, setShareImg] = useState(null);

  // ── RevenueCat state ──
  const [isPro, setIsPro] = useState(false);
  const [usageDisplay, setUsageDisplay] = useState('3 text scans · 1 image scan left today');
  const [showPaywall, setShowPaywall] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [rcReady, setRcReady] = useState(false);

  const textareaRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Init RevenueCat on mount ──
  useEffect(() => {
    const initRC = async () => {
      if (!Capacitor.isNativePlatform()) {
        // Dev mode: treat as pro so you can test UI in browser
        console.log('Not native — skipping RC, dev mode unlocked');
        setIsPro(true);
        setRcReady(true);
        return;
      }

      try {
        await Purchases.configure({ apiKey: RC_API_KEY });
        console.log('✅ RevenueCat initialized');

        // Check entitlement
        const { customerInfo } = await Purchases.getCustomerInfo();
        const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
        setIsPro(!!active);

        // Load offerings for paywall
        const offeringsResult = await Purchases.getOfferings();
        setOfferings(offeringsResult.offerings);

        // Show paywall if not subscribed
        if (!active) {
          setShowPaywall(true);
        }

        // Refresh usage display
        await refreshUsageDisplay();
        setRcReady(true);
      } catch (e) {
        console.error('❌ RevenueCat error:', e);
        setRcReady(true); // Let app load anyway
      }
    };

    initRC();
  }, []);

  // ── Purchase handler ──
  const handlePurchase = async (pkg) => {
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (active) {
        setIsPro(true);
        setShowPaywall(false);
      }
    } catch (e) {
      if (!e.userCancelled) {
        setPurchaseError(e?.message || 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  // ── Restore handler ──
  const handleRestore = async () => {
    setRestoring(true);
    setPurchaseError(null);
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (active) {
        setIsPro(true);
        setShowPaywall(false);
      } else {
        setPurchaseError('No active subscription found to restore.');
      }
    } catch (e) {
      setPurchaseError(e?.message || 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // ── Free tier usage tracking (Capacitor Preferences for native persistence) ──
  const refreshUsageDisplay = async () => {
    const usage = await getUsage();
    const textsLeft = Math.max(0, FREE_DAILY_TEXTS - usage.texts);
    const imagesLeft = Math.max(0, FREE_DAILY_IMAGES - usage.images);
    setUsageDisplay(`${textsLeft} text scan${textsLeft !== 1 ? 's' : ''} · ${imagesLeft} image scan left today`);
  };

  const getUsage = async () => {
    const today = new Date().toDateString();
    try {
      const { value } = await Preferences.get({ key: 'sr_usage' });
      const stored = JSON.parse(value || '{}');
      if (stored.date !== today) return { date: today, texts: 0, images: 0 };
      return stored;
    } catch { return { date: today, texts: 0, images: 0 }; }
  };
  const saveUsage = async (usage) => {
    try { await Preferences.set({ key: 'sr_usage', value: JSON.stringify(usage) }); } catch {}
  };

  const analyze = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || scanning) return;

    // Gate: check free tier limits if not pro
    if (!isPro) {
      const usage = await getUsage();
      const isImageScan = uploadedImages.length > 0;
      if (isImageScan && usage.images >= FREE_DAILY_IMAGES) {
        setShowPaywall(true); return;
      }
      if (!isImageScan && usage.texts >= FREE_DAILY_TEXTS) {
        setShowPaywall(true); return;
      }
    }

    setScanning(true);
    setResult(null);
    setShowResult(false);
    setError(null);
    setShareImg(null);

    try {
      const fd = new FormData();
      if (input.trim()) fd.append("text", input.trim());
      uploadedImages.forEach((file) => fd.append("images", file));

     const res = await fetch("https://social-radar-delta.vercel.app/api/analyze", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let msg = errText;
        try { const j = JSON.parse(errText); msg = j.error || errText; } catch {}
        throw new Error(msg || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      setShowResult(true);

      // Increment usage counter for free tier
      if (!isPro) {
        const usage = await getUsage();
        if (uploadedImages.length > 0) usage.images++;
        else usage.texts++;
        await saveUsage(usage);
        await refreshUsageDisplay();
      }
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setScanning(false);
    }
  };

  const compressImage = (file, maxWidth = 1600, quality = 0.8) => {
    return new Promise((resolve) => {
      if (file.size < 500_000) { resolve(file); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg', quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setUploadedImages((prev) => [...prev, ...compressed].slice(0, 3));
    e.target.value = '';
  };

  const removeUpload = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
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

    ctx.fillStyle = '#07070d'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,255,170,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const grd = ctx.createRadialGradient(200, 300, 0, 200, 300, 350);
    grd.addColorStop(0, 'rgba(0,255,170,0.04)'); grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff'; ctx.font = '900 48px Anybody, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Social Radar', W / 2, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '500 12px IBM Plex Mono, monospace';
    ctx.fillText('SIGNAL ANALYSIS REPORT', W / 2, 96);

    const vColor = r.verdict.includes('RED') ? '#ff2d55' : r.verdict.includes('GREEN') ? '#00ffaa' : '#ffb800';
    ctx.font = '48px sans-serif'; ctx.fillText(r.verdict_emoji || '🟡', W / 2, 160);
    ctx.fillStyle = vColor; ctx.font = '900 24px Anybody, sans-serif'; ctx.fillText(r.verdict, W / 2, 198);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(60, 225); ctx.lineTo(W - 60, 225); ctx.stroke();

    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,255,170,0.4)';
    ctx.font = '500 10px IBM Plex Mono, monospace'; ctx.fillText('◈ DECODED TRANSLATION', 60, 260);
    ctx.fillStyle = '#fff'; ctx.font = 'italic 700 20px Source Serif 4, serif';
    wrapText(ctx, `"${r.translation}"`, 60, 292, W - 120, 28);

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

    const fy = sy + 220;
    ctx.fillStyle = 'rgba(255,45,85,0.5)'; ctx.font = '500 10px IBM Plex Mono, monospace';
    ctx.fillText('🚩 RED FLAGS', 60, fy);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 13px Source Serif 4, serif';
    (r.red_flags || []).slice(0, 3).forEach((f, i) => ctx.fillText('• ' + f, 60, fy + 22 + i * 22));
    ctx.fillStyle = 'rgba(0,255,170,0.5)'; ctx.font = '500 10px IBM Plex Mono, monospace';
    ctx.fillText('✅ GREEN FLAGS', W / 2 + 20, fy);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 13px Source Serif 4, serif';
    (r.green_flags || []).slice(0, 3).forEach((f, i) => ctx.fillText('• ' + f, W / 2 + 20, fy + 22 + i * 22));

    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '400 11px IBM Plex Mono, monospace';
    ctx.fillText('socialradar.app  •  What are they actually thinking?', W / 2, H - 30);

    const dataUrl = canvas.toDataURL('image/png');
    setShareImg(dataUrl);

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
    setInput(''); setResult(null); setShowResult(false); setError(null); setShareImg(null); setUploadedImages([]);
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

      {/* ── Paywall Modal ── */}
      {showPaywall && (
        <PaywallModal
          offerings={offerings}
          onPurchase={handlePurchase}
          onRestore={handleRestore}
          onDismiss={() => setShowPaywall(false)}
          purchasing={purchasing}
          restoring={restoring}
          purchaseError={purchaseError}
        />
      )}

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
            {isPro ? 'PRO ACTIVE' : 'SIGNAL ACTIVE'}
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

          {!input && uploadedImages.length === 0 && !result && (
            <div style={{ textAlign: 'center', padding: '0 20px 18px' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5, animation: 'hintFloat 3s ease-in-out infinite' }}>📡</div>
              <div style={{ font: '400 13px/1.6 var(--serif)', color: 'rgba(255,255,255,0.25)' }}>
                Drop a message here and <span style={{ color: 'rgba(0,255,170,0.4)' }}>let&apos;s decode it</span>.<br />Screenshots work too.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload} style={{ display: 'none' }} />
            {uploadedImages.length < 3 && (
              <button onClick={() => fileInputRef.current?.click()} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 100, padding: '6px 14px',
                font: '400 11px/1 var(--mono)', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                📎 {uploadedImages.length === 0 ? 'Upload screenshots' : 'Add more'} ({uploadedImages.length}/3)
              </button>
            )}
            {uploadedImages.map((file, i) => (
              <div key={`${file.name}-${i}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(0,255,170,0.06)', border: '1px solid rgba(0,255,170,0.12)',
                borderRadius: 100, padding: '5px 12px',
                font: '400 11px/1 var(--mono)', color: 'var(--green)',
                maxWidth: '55%', overflow: 'hidden',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span onClick={() => removeUpload(i)} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 13, flexShrink: 0 }}>✕</span>
              </div>
            ))}
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
        <button onClick={analyze} disabled={(!input.trim() && uploadedImages.length === 0) || scanning}
          style={{
            width: '100%', padding: 16, border: 'none', borderRadius: 12,
            font: '700 13px/1 var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
            cursor: (input.trim() || uploadedImages.length > 0) && !scanning ? 'pointer' : 'default', marginBottom: 28,
            background: scanning ? 'rgba(0,255,170,0.08)' : (input.trim() || uploadedImages.length > 0) ? 'linear-gradient(135deg, var(--green), #00cc88)' : 'rgba(255,255,255,0.04)',
            color: scanning ? 'var(--green)' : (input.trim() || uploadedImages.length > 0) ? '#070a0d' : 'rgba(255,255,255,0.15)',
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
            <div style={{
              textAlign: 'center', padding: '36px 24px 32px', borderRadius: 16,
              background: verdictBg, border: `1px solid ${verdictBorder}`,
              boxShadow: `0 0 40px ${verdictBorder}, 0 0 80px ${verdictBorder}`,
              opacity: showResult ? 1 : 0, transform: showResult ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
              transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{ fontSize: 52, marginBottom: 14, filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.15))' }}>{result.verdict_emoji}</div>
              <div style={{ font: '900 26px/1 var(--display)', letterSpacing: 4, color: verdictColor }}>{result.verdict}</div>
              <div style={{ marginTop: 12, font: '400 11px/1 var(--mono)', color: 'var(--muted)', letterSpacing: 1.5 }}>SIGNAL VERDICT</div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 24px 22px',
              borderLeft: '3px solid rgba(0,255,170,0.3)',
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.1s',
            }}>
              <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(0,255,170,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                ◈ DECODED TRANSLATION
              </div>
              <p style={{ font: 'italic 700 22px/1.5 var(--serif)', color: '#fff', margin: '0 0 4px' }}>"{result.translation}"</p>
              <div style={{
                marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.025)', borderRadius: 8,
                font: '400 12px/1.4 var(--mono)', color: 'rgba(255,255,255,0.45)',
              }}>HIDDEN TONE: {result.hidden_tone}</div>
            </div>

            <div style={{ height: 1, margin: '4px 40px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.2s',
            }}>
              <div style={{ font: '500 10px/1 var(--mono)', color: 'rgba(0,212,255,0.5)', letterSpacing: 2, marginBottom: 12 }}>◉ SIGNAL ANALYSIS</div>
              <RadarChart scores={result.scores} animate={showResult} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {SCORE_META.map((m, i) => (
                  <ScoreBar key={m.key} meta={m} value={result.scores[m.key] || 0} delay={0.3 + i * 0.1} show={showResult} />
                ))}
              </div>
            </div>

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

            <div style={{
              textAlign: 'center', paddingTop: 8, paddingBottom: 32,
              opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.5s ease 0.6s',
            }}>
              <button onClick={generateShareCard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(0,255,170,0.12), rgba(0,212,255,0.08))',
                  border: '1px solid rgba(0,255,170,0.25)',
                  borderRadius: 100, padding: '14px 28px',
                  font: '700 12px/1 var(--mono)', color: 'var(--green)', cursor: 'pointer',
                  letterSpacing: 1.5, textTransform: 'uppercase',
                  animation: 'shareGlow 3s ease-in-out infinite',
                }}>
                <span style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite',
                }} />
                <span style={{ position: 'relative' }}>📤 SHARE YOUR RESULTS</span>
              </button>
              <div style={{ font: '400 11px/1.4 var(--mono)', color: 'rgba(255,255,255,0.2)', marginTop: 10, letterSpacing: 0.5 }}>
                show them what you found 👀
              </div>
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

        {/* ── Upgrade prompt for non-pro users ── */}
        {!isPro && !showPaywall && (
          <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
            <div style={{ font: '400 11px/1.5 var(--mono)', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>
              {usageDisplay}
            </div>
            <button onClick={() => setShowPaywall(true)} style={{
              background: 'none', border: '1px solid rgba(0,255,170,0.15)',
              borderRadius: 100, padding: '8px 20px',
              font: '400 11px/1 var(--mono)', color: 'rgba(0,255,170,0.5)',
              cursor: 'pointer', letterSpacing: 1,
            }}>⭐ Upgrade to Pro</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Canvas helpers ──
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text || '').split(' ');
  let line = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y);
      line = word + ' ';
      y += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}