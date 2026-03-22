import React, { useEffect, useState, useCallback, useRef } from “react”;
import { useApp } from “@/context/AppContext”;
import {
claimDailyReward,
getTransactions,
logAdWatch,
getDailyClaim
} from “@/lib/api”;
import { useRewardedAd } from “@/hooks/useAdsgram”;
import AdsgramTask from “@/components/AdsgramTask”;
type HapticType = “impact” | “success” | “error”;
interface Transaction {
id: string;
type: string;
points: number;
}
function triggerHaptic(type: HapticType) {
if (typeof window !== “undefined” && (window as any).Telegram) {
const tg = (window as any).Telegram.WebApp;
if (tg?.HapticFeedback) {
if (type === “impact”) tg.HapticFeedback.impactOccurred(“medium”);
if (type === “success”) tg.HapticFeedback.notificationOccurred(“success”);
if (type === “error”) tg.HapticFeedback.notificationOccurred(“error”);
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
function formatCountdown(seconds: number) {
const h = Math.floor(seconds / 3600);
const m = Math.floor((seconds % 3600) / 60);
const s = seconds % 60;
return ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")};
}
/* ── TX type formatting ── */
function txLabel(type: string): string {
const map: Record<string, string> = {
adsgram_reward:  “Adsgram Ad”,
tower_climb:     “Tower Climb”,
lucky_box:       “Lucky Box”,
dice_roll:       “Dice Roll”,
card_flip:       “Card Flip”,
number_guess:    “Number Guess”,
daily_reward:    “Daily Reward”,
referral_bonus:  “Referral Bonus”,
task_complete:   “Task Complete”,
};
return map[type] || type.replace(/_/g, “ “).replace(/\b\w/g, c => c.toUpperCase());
}
function txIcon(type: string): string {
const map: Record<string, string> = {
adsgram_reward: “🎬”, tower_climb: “🏗️”, lucky_box: “🎁”,
dice_roll: “🎲”, card_flip: “🃏”, number_guess: “🎯”,
daily_reward: “🔥”, referral_bonus: “👥”, task_complete: “✅”,
};
return map[type] || “💰”;
}
/* ── CSS ── */
const CSS = `
@import url(‘https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap’);
.hp-root {
font-family: ‘Rajdhani’, sans-serif;
padding: 0 16px 112px;
position: relative;
color: #fff;
min-height: 100vh;
}
/* ── Balance Card ── */
.hp-balance {
background: rgba(255,255,255,0.02);
border: 1px solid rgba(255,190,0,0.15);
border-radius: 24px;
padding: 24px 20px;
margin-bottom: 14px;
text-align: center;
position: relative;
overflow: hidden;
}
.hp-balance::before {
content: ‘’;
position: absolute;
top: 0; left: 15%; right: 15%;
height: 1px;
background: linear-gradient(90deg, transparent, rgba(255,190,0,0.4), transparent);
}
.hp-balance::after {
content: ‘’;
position: absolute;
inset: 0;
background-image:
linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
background-size: 28px 28px;
pointer-events: none;
border-radius: 24px;
}
.hp-balance-inner { position: relative; z-index: 1; }
.hp-burst {
font-size: 36px;
animation: hpBounce 0.6s cubic-bezier(0.34,1.56,0.64,1);
margin-bottom: 4px;
}
@keyframes hpBounce {
from { transform: scale(0.3) translateY(10px); opacity: 0; }
to   { transform: scale(1) translateY(0); opacity: 1; }
}
.hp-bal-label {
font-family: ‘Orbitron’, monospace;
font-size: 9px;
letter-spacing: 4px;
color: rgba(255,255,255,0.25);
text-transform: uppercase;
margin-bottom: 6px;
}
.hp-bal-value {
font-family: ‘Orbitron’, monospace;
font-size: 52px;
font-weight: 900;
line-height: 1;
color: #ffbe00;
text-shadow: 0 0 30px rgba(255,190,0,0.4), 0 0 60px rgba(255,190,0,0.15);
letter-spacing: 2px;
}
.hp-bal-sub {
font-size: 10px;
letter-spacing: 3px;
color: rgba(255,255,255,0.2);
text-transform: uppercase;
margin-top: 6px;
}
.hp-bal-msg {
margin-top: 10px;
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4px 14px;
border-radius: 20px;
background: rgba(74,222,128,0.1);
border: 1px solid rgba(74,222,128,0.25);
font-family: ‘Orbitron’, monospace;
font-size: 11px;
font-weight: 700;
color: #4ade80;
letter-spacing: 1px;
animation: hpMsgIn 0.3s ease;
}
@keyframes hpMsgIn {
from { opacity: 0; transform: translateY(4px); }
to   { opacity: 1; transform: translateY(0); }
}
/* ── Watch Ad Button ── */
.hp-ad-btn {
width: 100%;
padding: 18px;
border-radius: 18px;
border: none;
background: linear-gradient(135deg, #ffbe00 0%, #f59e0b 60%, #d97706 100%);
color: #1a0800;
font-family: ‘Orbitron’, monospace;
font-size: 16px;
font-weight: 700;
letter-spacing: 2px;
cursor: pointer;
transition: transform 0.12s, box-shadow 0.2s, opacity 0.2s;
box-shadow: 0 6px 28px rgba(255,190,0,0.35);
margin-bottom: 14px;
display: block;
position: relative;
overflow: hidden;
}
.hp-ad-btn::after {
content: ‘’;
position: absolute;
top: 0; left: -100%; width: 60%; height: 100%;
background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
animation: hpShine 3s ease-in-out infinite;
}
@keyframes hpShine { 0%{left:-100%} 40%,100%{left:150%} }
.hp-ad-btn:active { transform: scale(0.97); box-shadow: 0 2px 12px rgba(255,190,0,0.2); }
.hp-ad-btn:disabled { opacity: 0.6; cursor: not-allowed; }
/* ── Daily Reward ── */
.hp-daily {
background: rgba(255,255,255,0.02);
border: 1px solid rgba(255,255,255,0.07);
border-radius: 18px;
padding: 16px 18px;
display: flex;
align-items: center;
justify-content: space-between;
gap: 12px;
margin-bottom: 14px;
position: relative;
overflow: hidden;
}
.hp-daily::before {
content: ‘’;
position: absolute;
top: 0; left: 0; right: 0;
height: 1px;
background: linear-gradient(90deg, transparent, rgba(74,222,128,0.3), transparent);
}
.hp-daily-icon { font-size: 26px; flex-shrink: 0; }
.hp-daily-body { flex: 1; min-width: 0; }
.hp-daily-title {
font-family: ‘Orbitron’, monospace;
font-size: 11px;
font-weight: 700;
letter-spacing: 2px;
color: rgba(255,255,255,0.8);
margin-bottom: 3px;
}
.hp-daily-sub {
font-size: 12px;
color: rgba(255,255,255,0.35);
letter-spacing: 1px;
}
.hp-daily-sub.msg { color: #4ade80; }
.hp-daily-sub.timer {
font-family: ‘Orbitron’, monospace;
font-size: 12px;
color: rgba(255,255,255,0.3);
letter-spacing: 1px;
}
.hp-claim-btn {
padding: 10px 18px;
border-radius: 12px;
border: none;
background: linear-gradient(135deg, #4ade80, #16a34a);
color: #001a0a;
font-family: ‘Orbitron’, monospace;
font-size: 11px;
font-weight: 700;
letter-spacing: 1px;
cursor: pointer;
transition: transform 0.1s, opacity 0.2s;
box-shadow: 0 4px 16px rgba(74,222,128,0.3);
flex-shrink: 0;
white-space: nowrap;
}
.hp-claim-btn:active { transform: scale(0.95); }
.hp-claim-btn:disabled {
background: rgba(255,255,255,0.06);
border: 1px solid rgba(255,255,255,0.1);
color: rgba(255,255,255,0.25);
box-shadow: none;
cursor: not-allowed;
}
/* ── Tabs ── */
.hp-tabs {
display: flex;
background: rgba(255,255,255,0.03);
border: 1px solid rgba(255,255,255,0.06);
border-radius: 14px;
padding: 4px;
gap: 4px;
margin-bottom: 14px;
}
.hp-tab {
flex: 1;
padding: 9px;
border-radius: 10px;
border: none;
background: none;
font-family: ‘Orbitron’, monospace;
font-size: 10px;
font-weight: 700;
letter-spacing: 2px;
text-transform: uppercase;
color: rgba(255,255,255,0.25);
cursor: pointer;
transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.hp-tab.active {
background: #ffbe00;
color: #1a0800;
box-shadow: 0 2px 12px rgba(255,190,0,0.3);
}
/* ── Earn section ── */
.hp-earn { margin-bottom: 8px; }
/* ── History ── */
.hp-tx-empty {
text-align: center;
padding: 32px 0;
font-family: ‘Orbitron’, monospace;
font-size: 10px;
letter-spacing: 3px;
color: rgba(255,255,255,0.15);
text-transform: uppercase;
}
.hp-tx {
display: flex;
align-items: center;
gap: 12px;
background: rgba(255,255,255,0.02);
border: 1px solid rgba(255,255,255,0.05);
border-radius: 14px;
padding: 12px 14px;
margin-bottom: 8px;
transition: border-color 0.2s;
}
.hp-tx:hover { border-color: rgba(255,190,0,0.15); }
.hp-tx-icon {
width: 38px; height: 38px;
border-radius: 11px;
background: rgba(255,190,0,0.08);
border: 1px solid rgba(255,190,0,0.15);
display: flex; align-items: center; justify-content: center;
font-size: 17px;
flex-shrink: 0;
}
.hp-tx-body { flex: 1; min-width: 0; }
.hp-tx-label {
font-size: 13px;
font-weight: 600;
color: rgba(255,255,255,0.8);
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}
.hp-tx-sub {
font-size: 10px;
color: rgba(255,255,255,0.2);
letter-spacing: 1px;
margin-top: 1px;
}
.hp-tx-pts {
font-family: ‘Orbitron’, monospace;
font-size: 15px;
font-weight: 700;
color: #ffbe00;
letter-spacing: 0.5px;
flex-shrink: 0;
}
/* Loading dots */
.hp-dots span {
display: inline-block;
width: 5px; height: 5px;
border-radius: 50%;
background: #1a0800;
margin: 0 2px;
animation: hpDot 1.2s ease-in-out infinite;
}
.hp-dots span:nth-child(2) { animation-delay: 0.2s; }
.hp-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes hpDot { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
`;
export default function HomePage() {
const { user, balance, settings, refreshBalance } = useApp();
const [dailyClaiming, setDailyClaiming] = useState(false);
const [dailyMessage, setDailyMessage] = useState(””);
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [adLoading, setAdLoading] = useState(false);
const [dailyCooldown, setDailyCooldown] = useState(0);
const [coinBurst, setCoinBurst] = useState(false);
const [activeTab, setActiveTab] = useState<“earn” | “history”>(“earn”);
const COOLDOWN = 8000;
const isAdRunning = useRef(false);
const [lastAdTime, setLastAdTime] = useState<number>(() => {
if (typeof window !== “undefined”) return Number(localStorage.getItem(“lastAdTime”) || 0);
return 0;
});
useEffect(() => {
localStorage.setItem(“lastAdTime”, lastAdTime.toString());
}, [lastAdTime]);
const onAdsgramReward = useCallback(async () => {
if (!user) return;
triggerHaptic(“success”);
await logAdWatch(user.id, “adsgram_reward”, 40);
await refreshBalance();
setLastAdTime(Date.now());
setCoinBurst(true);
setDailyMessage(”+40 pts”);
setTimeout(() => setCoinBurst(false), 1200);
setTimeout(() => setDailyMessage(””), 3000);
}, [user, refreshBalance]);
const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramReward);
useEffect(() => {
if (!user) return;
getTransactions(user.id).then(setTransactions);
checkDailyCooldown();
}, [user]);
useEffect(() => {
if (dailyCooldown <= 0) return;
const interval = setInterval(() => {
setDailyCooldown((prev) => Math.max(0, prev - 1));
}, 1000);
return () => clearInterval(interval);
}, [dailyCooldown]);
async function checkDailyCooldown() {
if (!user) return;
const claim = await getDailyClaim(user.id);
if (claim) {
const now = new Date();
const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
setDailyCooldown(Math.max(0, Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)));
}
}
async function handleDailyClaim() {
if (!user || dailyCooldown > 0) return;
triggerHaptic(“impact”);
setDailyClaiming(true);
const result = await claimDailyReward(user.id);
if (result.success) {
triggerHaptic(“success”);
setDailyMessage(+${result.points} pts 🔥);
setCoinBurst(true);
const now = new Date();
const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
setDailyCooldown(Math.floor((midnightUTC.getTime() - now.getTime()) / 1000));
await refreshBalance();
setTimeout(() => setCoinBurst(false), 1200);
} else {
triggerHaptic(“error”);
setDailyMessage(result.message || “Already claimed!”);
await checkDailyCooldown();
}
setDailyClaiming(false);
setTimeout(() => setDailyMessage(””), 3000);
}
async function handleWatchAd() {
if (!user || isAdRunning.current) return;
if (Date.now() - lastAdTime < COOLDOWN) {
alert(“⏳ Wait a few seconds before next ad”);
return;
}
isAdRunning.current = true;
triggerHaptic(“impact”);
setAdLoading(true);
try {
await showAdsgramAd();
} catch {
alert(“Ad failed. Try again later.”);
}
setAdLoading(false);
isAdRunning.current = false;
}
return (
<>
<style>{CSS}</style>
<div className="hp-root">

    {/* ── BALANCE CARD ── */}
    <div className="hp-balance">
      <div className="hp-balance-inner">
        {coinBurst && <div className="hp-burst">💰</div>}
        <div className="hp-bal-label">Total Balance</div>
        <div className="hp-bal-value">
          <AnimatedNumber value={balance?.points || 0} />
        </div>
        <div className="hp-bal-sub">Available Points</div>
        {dailyMessage && (
          <div className="hp-bal-msg">
            ✦ {dailyMessage}
          </div>
        )}
      </div>
    </div>

    {/* ── WATCH AD ── */}
    <button className="hp-ad-btn" onClick={handleWatchAd} disabled={adLoading}>
      {adLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="hp-dots"><span /><span /><span /></span>
        </span>
      ) : (
        '🎬  WATCH AD  +40 PTS'
      )}
    </button>

    {/* ── DAILY REWARD ── */}
    <div className="hp-daily">
      <div className="hp-daily-icon">🎁</div>
      <div className="hp-daily-body">
        <div className="hp-daily-title">Daily Reward</div>
        {dailyMessage ? (
          <div className="hp-daily-sub msg">{dailyMessage}</div>
        ) : dailyCooldown > 0 ? (
          <div className="hp-daily-sub timer">{formatCountdown(dailyCooldown)}</div>
        ) : (
          <div className="hp-daily-sub">+{settings?.daily_bonus_base || 100} pts available</div>
        )}
      </div>
      <button
        className="hp-claim-btn"
        onClick={handleDailyClaim}
        disabled={dailyClaiming || dailyCooldown > 0}
      >
        {dailyCooldown > 0 ? "LOCKED" : dailyClaiming ? "..." : "CLAIM"}
      </button>
    </div>

    {/* ── TABS ── */}
    <div className="hp-tabs">
      <button
        className={`hp-tab ${activeTab === "earn" ? "active" : ""}`}
        onClick={() => setActiveTab("earn")}
      >
        Earn
      </button>
      <button
        className={`hp-tab ${activeTab === "history" ? "active" : ""}`}
        onClick={() => setActiveTab("history")}
      >
        History
      </button>
    </div>

    {/* ── EARN ── */}
    {activeTab === "earn" && (
      <div className="hp-earn">
        <AdsgramTask blockId="task-25198" />
      </div>
    )}

    {/* ── HISTORY ── */}
    {activeTab === "history" && (
      <div>
        {transactions.length === 0 ? (
          <div className="hp-tx-empty">No transactions yet</div>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="hp-tx">
              <div className="hp-tx-icon">{txIcon(t.type)}</div>
              <div className="hp-tx-body">
                <div className="hp-tx-label">{txLabel(t.type)}</div>
                <div className="hp-tx-sub">Points earned</div>
              </div>
              <div className="hp-tx-pts">+{t.points}</div>
            </div>
          ))
        )}
      </div>
    )}

  </div>
</>


);
}