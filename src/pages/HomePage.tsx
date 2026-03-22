import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getTransactions, logAdWatch } from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import { supabase } from "@/integrations/supabase/client";

type HapticType = "impact" | "success" | "error";

interface Transaction {
  id: string;
  type: string;
  points: number;
}

function triggerHaptic(type: HapticType) {
  if (typeof window !== "undefined" && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (tg?.HapticFeedback) {
      if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
      if (type === "success") tg.HapticFeedback.notificationOccurred("success");
      if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    }
  }
}

function AnimatedNumber({ value = 0 }: { value: number }) {
  const [display, setDisplay] = useState<number>(value);
  const prev = useRef<number>(value);
  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const steps = 30;
    const inc = diff / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += inc;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 20);
    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function txLabel(type: string): string {
  const map: Record<string, string> = {
    tap_earn: "Tap Earn", farm_claim: "Farm Reward",
    ad_watch: "Ad Watch", adsgram_reward: "Adsgram Ad",
    tower_climb: "Tower Climb", lucky_box: "Lucky Box",
    dice_roll: "Dice Roll", card_flip: "Card Flip",
    number_guess: "Number Guess", daily_reward: "Daily Reward",
    referral_bonus: "Referral Bonus", task_complete: "Task Complete",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function txIcon(type: string): string {
  const map: Record<string, string> = {
    tap_earn: "👆", farm_claim: "🌾", ad_watch: "🎬",
    adsgram_reward: "🎬", tower_climb: "🏗️", lucky_box: "🎁",
    dice_roll: "🎲", card_flip: "🃏", number_guess: "🎯",
    daily_reward: "🔥", referral_bonus: "👥", task_complete: "✅",
  };
  return map[type] || "💰";
}

/* ── Constants ── */
const MAX_ENERGY       = 50;
const REGEN_PER_SEC    = 50 / 3600;        // fills in 60 min
const FAST_REGEN_MULT  = 5;                // 5x faster when boosted
const BOOST_DURATION   = 5 * 60;          // 5 min in seconds
const FARM_DURATION_MS = 15 * 60 * 1000;
const FARM_REWARD      = 15;
const AD_MAX_PER_DAY   = 15;
const AD_REWARD        = 30;
const AD_COOLDOWN_SEC  = 10;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes hpShine   { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes hpDot     { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes hpFadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpBounce  { from{transform:scale(0.3) translateY(10px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
@keyframes hpMsgIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes hpRipple  { 0%{transform:scale(0.9);opacity:0.6} 100%{transform:scale(2);opacity:0} }
@keyframes hpTapPop  { 0%{transform:scale(1)} 30%{transform:scale(0.91)} 100%{transform:scale(1)} }
@keyframes hpGoldGlow{ 0%,100%{box-shadow:0 0 28px rgba(255,190,0,0.35),0 0 0 3px rgba(255,190,0,0.15)} 50%{box-shadow:0 0 52px rgba(255,190,0,0.65),0 0 0 3px rgba(255,190,0,0.3)} }
@keyframes hpX2Glow  { 0%,100%{box-shadow:0 0 20px rgba(251,191,36,0.3)} 50%{box-shadow:0 0 40px rgba(251,191,36,0.7)} }
@keyframes hpFastGlow{ 0%,100%{box-shadow:0 0 20px rgba(34,211,238,0.3)} 50%{box-shadow:0 0 40px rgba(34,211,238,0.7)} }
@keyframes hpFarmPulse{0%,100%{border-color:rgba(74,222,128,0.2)} 50%{border-color:rgba(74,222,128,0.5)} }
@keyframes hpCdFlash { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes hpFloatPts{ 0%{opacity:1;transform:translateY(0) scale(1.1)} 100%{opacity:0;transform:translateY(-70px) scale(0.7)} }
@keyframes hpEnergyPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

.hp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Msg banner ── */
.hp-msg-banner {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 14px; margin-bottom: 14px;
  background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2);
  font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 700;
  color: #4ade80; letter-spacing: 1px;
  animation: hpMsgIn 0.3s ease, hpFadeIn 0.3s ease;
}

/* ══════ TAP CARD ══════ */
.hp-tap-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 24px; padding: 20px 16px 18px;
  margin-bottom: 14px; position: relative; overflow: hidden;
  animation: hpFadeIn 0.4s ease;
}
.hp-tap-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,190,0,0.45),transparent);
}
.hp-tap-card::after {
  content:''; position:absolute; inset:0;
  background-image: linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);
  background-size:28px 28px; pointer-events:none; border-radius:24px;
}

/* Header row */
.hp-tap-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:18px; position:relative; z-index:1;
}
.hp-tap-title { font-family:'Orbitron',monospace; font-size:12px; font-weight:900; letter-spacing:2px; color:#fff; }
.hp-tap-title span { color:#ffbe00; }
.hp-energy-pill {
  display:flex; align-items:center; gap:5px;
  padding:4px 12px; border-radius:20px;
  background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.2);
  font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#ffbe00;
}
.hp-energy-pill.recharging { animation: hpEnergyPulse 1.5s ease-in-out infinite; }

/* Tap button area */
.hp-tap-center {
  display:flex; flex-direction:column; align-items:center;
  gap:16px; position:relative; z-index:1;
}

.hp-tap-btn-wrap {
  position:relative; width:150px; height:150px;
  display:flex; align-items:center; justify-content:center;
}
.hp-tap-ripple {
  position:absolute; inset:0; border-radius:50%;
  border:2px solid rgba(255,190,0,0.4);
  animation: hpRipple 1.8s ease-out infinite;
  pointer-events:none;
}
.hp-tap-ripple:nth-child(2) { animation-delay:0.6s; }
.hp-tap-ripple:nth-child(3) { animation-delay:1.2s; }

.hp-tap-btn {
  width:130px; height:130px; border-radius:50%; border:none;
  background: radial-gradient(circle at 38% 33%, rgba(255,255,255,0.1) 0%, rgba(255,190,0,0.04) 60%);
  border:2.5px solid rgba(255,190,0,0.5);
  cursor:pointer; position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
  animation: hpGoldGlow 2.5s ease-in-out infinite;
  -webkit-tap-highlight-color: transparent; user-select:none;
  transition: opacity 0.2s;
}
.hp-tap-btn:active { animation: hpTapPop 0.15s ease, hpGoldGlow 2.5s ease-in-out infinite; }
.hp-tap-btn:disabled { opacity:0.3; cursor:not-allowed; animation:none; box-shadow:none; }
.hp-tap-btn-emoji { font-size:52px; line-height:1; pointer-events:none; animation:hpFloat 3s ease-in-out infinite; }
.hp-tap-btn-sub { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; color:rgba(255,190,0,0.7); letter-spacing:1px; pointer-events:none; }

/* Floating pts */
.hp-float-pts {
  position:absolute; font-family:'Orbitron',monospace;
  font-size:18px; font-weight:900; color:#ffbe00;
  pointer-events:none; z-index:99; white-space:nowrap;
  text-shadow:0 0 12px rgba(255,190,0,0.9);
  animation: hpFloatPts 0.9s ease-out forwards;
}

/* Energy bar */
.hp-energy-wrap { width:100%; }
.hp-energy-labels {
  display:flex; justify-content:space-between;
  font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px;
  color:rgba(255,255,255,0.2); margin-bottom:6px;
}
.hp-energy-track {
  height:8px; border-radius:4px; background:rgba(255,255,255,0.06);
  overflow:hidden; position:relative;
}
.hp-energy-fill {
  height:100%; border-radius:4px;
  transition: width 0.5s ease;
}
.hp-energy-segments {
  position:absolute; inset:0;
  display:flex; gap:2px; padding:0 2px;
  pointer-events:none;
}
.hp-energy-seg { flex:1; border-right:1px solid rgba(6,8,15,0.4); }

/* Recharge label */
.hp-recharge-label {
  text-align:center; font-family:'Orbitron',monospace;
  font-size:9px; letter-spacing:2px; margin-top:6px;
  animation: hpCdFlash 1.5s ease-in-out infinite;
}

/* ── Boost buttons row ── */
.hp-boost-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; position:relative; z-index:1; }
.hp-boost-btn {
  padding:11px 10px; border-radius:14px; border:none;
  cursor:pointer; transition:transform 0.12s; text-align:center;
  position:relative; overflow:hidden;
}
.hp-boost-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-boost-btn:active { transform:scale(0.95); }
.hp-boost-btn:disabled { opacity:0.4; cursor:not-allowed; }
.hp-boost-btn:disabled::after { display:none; }

.hp-boost-btn.x2 {
  background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); color:#fbbf24;
}
.hp-boost-btn.x2.active-boost { animation:hpX2Glow 1.5s ease-in-out infinite; border-color:rgba(251,191,36,0.6); background:rgba(251,191,36,0.18); }
.hp-boost-btn.fast {
  background:rgba(34,211,238,0.08); border:1px solid rgba(34,211,238,0.25); color:#22d3ee;
}
.hp-boost-btn.fast.active-boost { animation:hpFastGlow 1.5s ease-in-out infinite; border-color:rgba(34,211,238,0.6); background:rgba(34,211,238,0.15); }

.hp-boost-icon  { font-size:20px; margin-bottom:4px; }
.hp-boost-label { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:1px; margin-bottom:2px; }
.hp-boost-sub   { font-size:10px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-boost-timer { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; margin-top:3px; animation:hpCdFlash 1s ease-in-out infinite; }

/* ══════ FARM CARD ══════ */
.hp-farm-card {
  background:rgba(255,255,255,0.02); border:1px solid rgba(74,222,128,0.15);
  border-radius:22px; padding:18px 16px; margin-bottom:14px;
  position:relative; overflow:hidden; animation:hpFadeIn 0.4s 0.1s ease both;
}
.hp-farm-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(74,222,128,0.4),transparent);
}
.hp-farm-card.farming { animation:hpFarmPulse 2.5s ease-in-out infinite; }

.hp-farm-top { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.hp-farm-icon { width:44px; height:44px; border-radius:13px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
.hp-farm-info { flex:1; min-width:0; }
.hp-farm-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:2px; }
.hp-farm-sub { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-farm-sub.live { color:#4ade80; }
.hp-farm-badge { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#4ade80; padding:4px 10px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); border-radius:20px; flex-shrink:0; }

.hp-farm-prog-labels { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.hp-farm-track { height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:12px; }
.hp-farm-fill  { height:100%; border-radius:3px; transition:width 0.5s ease; }

.hp-farm-btn {
  width:100%; padding:13px; border-radius:14px; border:none;
  font-family:'Orbitron',monospace; font-size:12px; font-weight:700;
  letter-spacing:2px; cursor:pointer; transition:transform 0.12s;
  position:relative; overflow:hidden;
}
.hp-farm-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-farm-btn:active { transform:scale(0.97); }
.hp-farm-btn.start { background:linear-gradient(135deg,#4ade80,#16a34a); color:#001a0a; box-shadow:0 4px 18px rgba(74,222,128,0.3); }
.hp-farm-btn.claim { background:linear-gradient(135deg,#ffbe00,#f59e0b); color:#1a0800; box-shadow:0 4px 18px rgba(255,190,0,0.3); }
.hp-farm-btn.wait  { background:rgba(255,255,255,0.03); border:1px solid rgba(74,222,128,0.15); color:rgba(74,222,128,0.4); cursor:not-allowed; }
.hp-farm-btn.wait::after { display:none; }

/* ══════ AD CARD ══════ */
.hp-ad-card {
  background:rgba(255,255,255,0.02); border:1px solid rgba(255,190,0,0.15);
  border-radius:22px; padding:18px 16px; margin-bottom:14px;
  position:relative; overflow:hidden; animation:hpFadeIn 0.4s 0.2s ease both;
}
.hp-ad-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent);
}
.hp-ad-top { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.hp-ad-icon { width:44px; height:44px; border-radius:13px; background:rgba(255,190,0,0.1); border:1px solid rgba(255,190,0,0.25); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
.hp-ad-info { flex:1; min-width:0; }
.hp-ad-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:2px; }
.hp-ad-sub { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-ad-badge { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#ffbe00; padding:4px 10px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.2); border-radius:20px; flex-shrink:0; }

.hp-ad-prog-track { height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:12px; }
.hp-ad-prog-fill  { height:100%; border-radius:2px; background:linear-gradient(90deg,#ffbe00,#f59e0b); transition:width 0.4s; }

.hp-ad-btn {
  width:100%; padding:14px; border-radius:14px; border:none;
  background:linear-gradient(135deg,#ffbe00,#f59e0b,#d97706);
  color:#1a0800; font-family:'Orbitron',monospace; font-size:13px;
  font-weight:700; letter-spacing:2px; cursor:pointer;
  transition:transform 0.12s, opacity 0.2s;
  box-shadow:0 6px 24px rgba(255,190,0,0.35);
  position:relative; overflow:hidden;
}
.hp-ad-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-ad-btn:active { transform:scale(0.97); }
.hp-ad-btn:disabled { opacity:0.5; cursor:not-allowed; }
.hp-ad-btn.ghost { background:rgba(255,255,255,0.03); border:1px solid rgba(255,190,0,0.1); color:rgba(255,190,0,0.35); box-shadow:none; }
.hp-ad-btn.ghost::after { display:none; }
.hp-cd-txt { font-family:'Orbitron',monospace; font-size:11px; letter-spacing:2px; animation:hpCdFlash 1s ease-in-out infinite; }

/* ── Tabs ── */
.hp-tabs { display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:4px; gap:4px; margin-bottom:14px; }
.hp-tab { flex:1; padding:9px; border-radius:10px; border:none; background:none; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.25); cursor:pointer; transition:background 0.2s,color 0.2s; }
.hp-tab.active { background:#ffbe00; color:#1a0800; box-shadow:0 2px 12px rgba(255,190,0,0.3); }

/* ── History ── */
.hp-tx-empty { text-align:center; padding:32px 0; font-family:'Orbitron',monospace; font-size:10px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; }
.hp-tx { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px 14px; margin-bottom:8px; }
.hp-tx-icon { width:36px; height:36px; border-radius:10px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.15); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.hp-tx-body { flex:1; min-width:0; }
.hp-tx-label { font-size:13px; font-weight:600; color:rgba(255,255,255,0.8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hp-tx-sub { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1px; margin-top:1px; }
.hp-tx-pts { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; color:#ffbe00; flex-shrink:0; }

.hp-dots span { display:inline-block; width:5px; height:5px; border-radius:50%; background:currentColor; margin:0 2px; animation:hpDot 1.2s ease-in-out infinite; }
.hp-dots span:nth-child(2){animation-delay:0.2s} .hp-dots span:nth-child(3){animation-delay:0.4s}
`;

interface FloatPt { id: number; x: number; y: number; val: number; }

export default function HomePage() {
  const { user, balance, refreshBalance } = useApp();
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [activeTab, setActiveTab]         = useState<"earn" | "history">("earn");
  const [message, setMessage]             = useState("");
  const tapBtnRef = useRef<HTMLButtonElement>(null);

  /* ── Energy ── */
  const [energy, setEnergy] = useState<number>(() => {
    const s = localStorage.getItem("energy");
    return s !== null ? Math.min(MAX_ENERGY, parseFloat(s)) : MAX_ENERGY;
  });
  const [lastEnergyTime, setLastEnergyTime] = useState<number>(() => {
    return Number(localStorage.getItem("lastEnergyTime") || Date.now());
  });
  const energyRef = useRef(energy);
  energyRef.current = energy;

  /* ── Boosts ── */
  const [x2Active, setX2Active]       = useState(false);
  const [x2SecsLeft, setX2SecsLeft]   = useState(0);
  const [fastActive, setFastActive]   = useState(false);
  const [fastSecsLeft, setFastSecsLeft] = useState(0);

  /* ── Float pts ── */
  const [floatPts, setFloatPts] = useState<FloatPt[]>([]);

  /* ── Farm ── */
  const [farmStart, setFarmStart]     = useState<number | null>(() => {
    const s = localStorage.getItem("farmStart");
    return s ? Number(s) : null;
  });
  const [farmProgress, setFarmProgress] = useState(0);
  const [farmReady, setFarmReady]     = useState(false);
  const [farmTimeLeft, setFarmTimeLeft] = useState("");
  const [farmClaiming, setFarmClaiming] = useState(false);

  /* ── Ads ── */
  const [adsToday, setAdsToday]       = useState(0);
  const [adCooldown, setAdCooldown]   = useState(0);
  const [adLoading, setAdLoading]     = useState(false);
  const isAdRunning = useRef(false);

  /* ── Load data ── */
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    loadTodayAds();
    // Restore energy from elapsed time
    const elapsed = (Date.now() - lastEnergyTime) / 1000;
    const regained = elapsed * REGEN_PER_SEC;
    setEnergy(prev => Math.min(MAX_ENERGY, prev + regained));
  }, [user]);

  async function loadTodayAds() {
    if (!user) return;
    const start = new Date(); start.setUTCHours(0,0,0,0);
    const { count } = await supabase
      .from('ad_logs').select('id', { count:'exact', head:true })
      .eq('user_id', user.id).gte('created_at', start.toISOString());
    setAdsToday(count || 0);
  }

  /* ── Energy regen ticker ── */
  useEffect(() => {
    const t = setInterval(() => {
      setEnergy(prev => {
        if (prev >= MAX_ENERGY) return MAX_ENERGY;
        const mult = fastActive ? FAST_REGEN_MULT : 1;
        const next = Math.min(MAX_ENERGY, prev + REGEN_PER_SEC * mult);
        localStorage.setItem("energy", String(next));
        localStorage.setItem("lastEnergyTime", String(Date.now()));
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fastActive]);

  /* ── Boost timers ── */
  useEffect(() => {
    if (!x2Active) return;
    const t = setInterval(() => {
      setX2SecsLeft(p => {
        if (p <= 1) { setX2Active(false); clearInterval(t); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [x2Active]);

  useEffect(() => {
    if (!fastActive) return;
    const t = setInterval(() => {
      setFastSecsLeft(p => {
        if (p <= 1) { setFastActive(false); clearInterval(t); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fastActive]);

  /* ── Farm ticker ── */
  useEffect(() => {
    if (!farmStart) return;
    const t = setInterval(() => {
      const elapsed = Date.now() - farmStart;
      const pct = Math.min(100, (elapsed / FARM_DURATION_MS) * 100);
      setFarmProgress(pct);
      if (elapsed >= FARM_DURATION_MS) {
        setFarmReady(true); setFarmProgress(100); setFarmTimeLeft("Ready!"); clearInterval(t);
      } else {
        const rem = Math.ceil((FARM_DURATION_MS - elapsed) / 1000);
        setFarmTimeLeft(`${Math.floor(rem/60)}:${(rem%60).toString().padStart(2,'0')}`);
      }
    }, 500);
    return () => clearInterval(t);
  }, [farmStart]);

  /* ── Ad cooldown ── */
  useEffect(() => {
    if (adCooldown <= 0) return;
    const t = setInterval(() => setAdCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [adCooldown]);

  function showMsg(text: string) {
    setMessage(text); setTimeout(() => setMessage(""), 2500);
  }

  function fmtBoostTime(s: number) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  }

  /* ══ TAP ══ */
  async function handleTap(e: React.MouseEvent<HTMLButtonElement>) {
    if (!user || energy < 1) return;
    triggerHaptic("impact");

    const ptsPerTap = x2Active ? 2 : 1;
    const newEnergy = Math.max(0, energy - 1);
    setEnergy(newEnergy);
    localStorage.setItem("energy", String(newEnergy));
    localStorage.setItem("lastEnergyTime", String(Date.now()));

    // Floating number
    const rect = tapBtnRef.current?.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const x = rect ? e.clientX - rect.left - 14 : 50;
    const y = rect ? e.clientY - rect.top - 30 : 20;
    setFloatPts(p => [...p, { id, x, y, val: ptsPerTap }]);
    setTimeout(() => setFloatPts(p => p.filter(f => f.id !== id)), 900);

    // Credit Supabase
    const { data: bal } = await supabase
      .from('balances').select('points,total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + ptsPerTap,
        total_earned: bal.total_earned + ptsPerTap,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'tap_earn', points: ptsPerTap,
        description: `👆 Tap Earn${x2Active ? ' (2x)' : ''}`,
      });
      refreshBalance();
    }
  }

  /* ══ BOOST: X2 per tap ══ */
  const onX2Reward = useCallback(() => {
    setX2Active(true); setX2SecsLeft(BOOST_DURATION);
    triggerHaptic("success"); showMsg("⚡ 2x Tap active for 5 min!");
  }, []);
  const { showAd: showX2Ad } = useRewardedAd(onX2Reward);

  /* ══ BOOST: Fast regen ══ */
  const onFastReward = useCallback(() => {
    setFastActive(true); setFastSecsLeft(BOOST_DURATION);
    triggerHaptic("success"); showMsg("⚡ Fast charge active for 5 min!");
  }, []);
  const { showAd: showFastAd } = useRewardedAd(onFastReward);

  /* ══ FARM ══ */
  function handleStartFarm() {
    if (farmStart) return;
    const now = Date.now();
    setFarmStart(now); setFarmProgress(0); setFarmReady(false);
    localStorage.setItem("farmStart", String(now));
    triggerHaptic("impact"); showMsg("🌾 Farming started!");
  }

  async function handleClaimFarm() {
    if (!user || farmClaiming || !farmReady) return;
    triggerHaptic("success"); setFarmClaiming(true);
    const { data: bal } = await supabase
      .from('balances').select('points,total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + FARM_REWARD, total_earned: bal.total_earned + FARM_REWARD,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'farm_claim', points: FARM_REWARD,
        description: `🌾 Farm Reward: +${FARM_REWARD} pts`,
      });
      await refreshBalance();
    }
    setFarmStart(null); setFarmProgress(0); setFarmReady(false); setFarmTimeLeft("");
    setFarmClaiming(false); localStorage.removeItem("farmStart");
    showMsg(`+${FARM_REWARD} pts 🌾`);
    getTransactions(user.id).then(setTransactions);
  }

  /* ══ AD WATCH ══ */
  const onAdReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await logAdWatch(user.id, "ad_watch", AD_REWARD);
    const { data: bal } = await supabase
      .from('balances').select('points,total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + AD_REWARD, total_earned: bal.total_earned + AD_REWARD,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'ad_watch', points: AD_REWARD,
        description: `🎬 Ad Watch: +${AD_REWARD} pts`,
      });
    }
    await refreshBalance();
    setAdsToday(p => p + 1);
    setAdCooldown(AD_COOLDOWN_SEC);
    showMsg(`+${AD_REWARD} pts 🎬`);
    getTransactions(user.id).then(setTransactions);
  }, [user, refreshBalance]);

  const { showAd: showMainAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user || isAdRunning.current || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY) return;
    isAdRunning.current = true;
    triggerHaptic("impact"); setAdLoading(true);
    try { await showMainAd(); } catch { showMsg("Ad failed."); }
    setAdLoading(false); isAdRunning.current = false;
  }

  const energyPct   = (energy / MAX_ENERGY) * 100;
  const isFarming   = !!farmStart && !farmReady;
  const energyColor = energyPct > 50 ? '#ffbe00' : energyPct > 20 ? '#f97316' : '#ef4444';

  return (
    <>
      <style>{CSS}</style>
      <div className="hp-root">

        {/* Message */}
        {message && (
          <div className="hp-msg-banner">✦ {message}</div>
        )}

        {/* ══════ TAP TO EARN ══════ */}
        <div className="hp-tap-card">
          <div className="hp-tap-header">
            <div className="hp-tap-title">⚡ TAP <span>TO EARN</span></div>
            <div className={`hp-energy-pill ${energy < MAX_ENERGY ? 'recharging' : ''}`}>
              ⚡ {Math.floor(energy)}/{MAX_ENERGY}
            </div>
          </div>

          <div className="hp-tap-center">
            {/* Tap button */}
            <div className="hp-tap-btn-wrap">
              <div className="hp-tap-ripple"/>
              <div className="hp-tap-ripple"/>
              <div className="hp-tap-ripple"/>
              <button
                ref={tapBtnRef}
                className="hp-tap-btn"
                onClick={handleTap}
                disabled={energy < 1}
              >
                <span className="hp-tap-btn-emoji">🪙</span>
                <span className="hp-tap-btn-sub">
                  {x2Active ? '+2 PTS' : '+1 PT'}
                </span>
              </button>
              {floatPts.map(f => (
                <div key={f.id} className="hp-float-pts"
                  style={{ left: f.x, top: f.y }}>
                  +{f.val}
                </div>
              ))}
            </div>

            {/* Energy bar */}
            <div className="hp-energy-wrap">
              <div className="hp-energy-labels">
                <span>ENERGY</span>
                <span style={{ color: energyColor }}>
                  {energy >= MAX_ENERGY ? '⚡ FULL' : fastActive ? `⚡ FAST CHARGE` : `+${(REGEN_PER_SEC * 60).toFixed(1)}/min`}
                </span>
              </div>
              <div className="hp-energy-track">
                <div className="hp-energy-fill" style={{
                  width: `${energyPct}%`,
                  background: `linear-gradient(90deg, ${energyColor}80, ${energyColor})`,
                  boxShadow: `0 0 8px ${energyColor}60`,
                }}/>
                {/* Segment ticks every 10 */}
                <div className="hp-energy-segments">
                  {Array.from({length: 9}).map((_, i) => (
                    <div key={i} className="hp-energy-seg"/>
                  ))}
                </div>
              </div>
              {energy < 1 && (
                <div className="hp-recharge-label" style={{ color: '#ef4444' }}>
                  ⏳ Recharging...
                </div>
              )}
            </div>
          </div>

          {/* Boost buttons */}
          <div className="hp-boost-row">
            {/* x2 tap */}
            <button
              className={`hp-boost-btn x2 ${x2Active ? 'active-boost' : ''}`}
              onClick={() => { if (!x2Active) showX2Ad(); }}
              disabled={x2Active}
            >
              <div className="hp-boost-icon">⚡</div>
              <div className="hp-boost-label">2× PER TAP</div>
              {x2Active ? (
                <div className="hp-boost-timer" style={{ color:'#fbbf24' }}>
                  {fmtBoostTime(x2SecsLeft)}
                </div>
              ) : (
                <div className="hp-boost-sub">Watch ad</div>
              )}
            </button>

            {/* Fast regen */}
            <button
              className={`hp-boost-btn fast ${fastActive ? 'active-boost' : ''}`}
              onClick={() => { if (!fastActive) showFastAd(); }}
              disabled={fastActive}
            >
              <div className="hp-boost-icon">🔋</div>
              <div className="hp-boost-label">FAST CHARGE</div>
              {fastActive ? (
                <div className="hp-boost-timer" style={{ color:'#22d3ee' }}>
                  {fmtBoostTime(fastSecsLeft)}
                </div>
              ) : (
                <div className="hp-boost-sub">Watch ad</div>
              )}
            </button>
          </div>
        </div>

        {/* ══════ FARM ══════ */}
        <div className={`hp-farm-card ${isFarming ? 'farming' : ''}`}>
          <div className="hp-farm-top">
            <div className="hp-farm-icon">🌾</div>
            <div className="hp-farm-info">
              <div className="hp-farm-title">FARMING</div>
              <div className={`hp-farm-sub ${isFarming || farmReady ? 'live' : ''}`}>
                {farmReady ? '✦ Ready to claim!'
                  : isFarming ? `⏱ ${farmTimeLeft} remaining`
                  : '15 min → +15 pts'}
              </div>
            </div>
            <div className="hp-farm-badge">+{FARM_REWARD} PTS</div>
          </div>

          <div className="hp-farm-prog-labels">
            <span>{farmReady ? 'Complete!' : isFarming ? 'Farming...' : 'Idle'}</span>
            <span style={{ color: farmReady ? '#ffbe00' : '#4ade80' }}>
              {Math.round(farmProgress)}%
            </span>
          </div>
          <div className="hp-farm-track">
            <div className="hp-farm-fill" style={{
              width: `${farmProgress}%`,
              background: farmReady
                ? 'linear-gradient(90deg,#ffbe00,#f59e0b)'
                : 'linear-gradient(90deg,#4ade80,#22d3ee)',
              boxShadow: isFarming ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
            }}/>
          </div>

          {farmReady ? (
            <button className="hp-farm-btn claim" onClick={handleClaimFarm} disabled={farmClaiming}>
              {farmClaiming
                ? <span className="hp-dots" style={{color:'#1a0800'}}><span/><span/><span/></span>
                : '🎁 CLAIM +15 PTS'}
            </button>
          ) : isFarming ? (
            <button className="hp-farm-btn wait" disabled>
              🌾 FARMING... {farmTimeLeft}
            </button>
          ) : (
            <button className="hp-farm-btn start" onClick={handleStartFarm}>
              🚀 START FARMING
            </button>
          )}
        </div>

        {/* ══════ WATCH ADS ══════ */}
        <div className="hp-ad-card">
          <div className="hp-ad-top">
            <div className="hp-ad-icon">🎬</div>
            <div className="hp-ad-info">
              <div className="hp-ad-title">WATCH ADS</div>
              <div className="hp-ad-sub">
                {adsToday >= AD_MAX_PER_DAY
                  ? '✅ Daily limit reached'
                  : `${adsToday} / ${AD_MAX_PER_DAY} today`}
              </div>
            </div>
            <div className="hp-ad-badge">+{AD_REWARD} PTS</div>
          </div>

          <div className="hp-ad-prog-track">
            <div className="hp-ad-prog-fill"
              style={{ width: `${(adsToday / AD_MAX_PER_DAY) * 100}%` }}/>
          </div>

          <button
            className={`hp-ad-btn ${
              adsToday >= AD_MAX_PER_DAY || adCooldown > 0 ? 'ghost' : ''
            }`}
            onClick={handleWatchAd}
            disabled={adLoading || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY}
          >
            {adLoading ? (
              <span className="hp-dots" style={{color:'#1a0800'}}><span/><span/><span/></span>
            ) : adsToday >= AD_MAX_PER_DAY ? (
              '✅ COME BACK TOMORROW'
            ) : adCooldown > 0 ? (
              <span className="hp-cd-txt">⏳ NEXT AD IN {adCooldown}s</span>
            ) : (
              '🎬  WATCH AD  +30 PTS'
            )}
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="hp-tabs">
          <button className={`hp-tab ${activeTab==="earn"?"active":""}`} onClick={()=>setActiveTab("earn")}>Earn</button>
          <button className={`hp-tab ${activeTab==="history"?"active":""}`} onClick={()=>setActiveTab("history")}>History</button>
        </div>

        {activeTab === "earn" && (
          <div style={{textAlign:'center',padding:'20px 0',fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:'3px',color:'rgba(255,255,255,0.12)',textTransform:'uppercase'}}>
            ✦ Tap · Farm · Watch Ads to earn ✦
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {transactions.length === 0
              ? <div className="hp-tx-empty">No transactions yet</div>
              : transactions.map(t => (
                <div key={t.id} className="hp-tx">
                  <div className="hp-tx-icon">{txIcon(t.type)}</div>
                  <div className="hp-tx-body">
                    <div className="hp-tx-label">{txLabel(t.type)}</div>
                    <div className="hp-tx-sub">Points earned</div>
                  </div>
                  <div className="hp-tx-pts">+{t.points}</div>
                </div>
              ))}
          </div>
        )}

      </div>
    </>
  );
}
