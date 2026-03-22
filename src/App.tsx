import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import HomePage from "@/pages/HomePage";
import TasksPage from "@/pages/TasksPage";
import SpinPage from "@/pages/SpinPage";
import ReferralPage from "@/pages/ReferralPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import WalletPage from "@/pages/WalletPage";
import NotificationsPage from "@/pages/NotificationsPage";
import AdminPanel from "@/pages/AdminPanel";
import GamesPage from "@/pages/GamesPage";
import TowerClimbPage from "@/pages/TowerClimbPage";
import LuckyBoxPage from "@/pages/LuckyBoxPage";
import DiceRollPage from "@/pages/DiceRollPage";
import CardFlipPage from "@/pages/CardFlipPage";
import NumberGuessPage from "@/pages/NumberGuessPage";

const queryClient = new QueryClient();

type Page =
  | "home" | "tasks" | "spin" | "referral" | "leaderboard"
  | "wallet" | "notifications" | "admin" | "games"
  | "tower" | "dice" | "cardflip" | "numberguess" | "luckybox";

/* ── Global styles ── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

* { box-sizing: border-box; }

body {
  background: #06080f;
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  margin: 0; padding: 0;
  overflow-x: hidden;
}

/* ── LOADING SCREEN ── */
@keyframes ldSpin    { to { transform: rotate(360deg); } }
@keyframes ldPulse   { 0%,100%{opacity:0.4;transform:scale(0.85)} 50%{opacity:1;transform:scale(1)} }
@keyframes ldFloat   { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-12px) rotate(2deg)} }
@keyframes ldBeam    { 0%{opacity:0;transform:scaleX(0)} 50%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
@keyframes ldFadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes ldOrbit   { from{transform:rotate(0deg) translateX(52px) rotate(0deg)} to{transform:rotate(360deg) translateX(52px) rotate(-360deg)} }
@keyframes ldBar     { 0%{width:0%} 100%{width:92%} }
@keyframes ldDot     { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1.2);opacity:1} }
@keyframes ldGlow    { 0%,100%{box-shadow:0 0 20px rgba(255,190,0,0.3)} 50%{box-shadow:0 0 60px rgba(255,190,0,0.7)} }

.ld-root {
  position: fixed; inset: 0;
  background: #06080f;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}

.ld-bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,190,0,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,190,0,0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
}
.ld-bg-glow1 {
  position: absolute; width: 400px; height: 400px;
  border-radius: 50%; top: -100px; left: -100px;
  background: radial-gradient(circle, rgba(255,190,0,0.06) 0%, transparent 70%);
  pointer-events: none;
}
.ld-bg-glow2 {
  position: absolute; width: 300px; height: 300px;
  border-radius: 50%; bottom: -60px; right: -60px;
  background: radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%);
  pointer-events: none;
}

.ld-logo-wrap {
  position: relative;
  width: 120px; height: 120px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 32px;
  animation: ldFadeUp 0.6s ease both;
}

/* Outer spinning ring */
.ld-ring-outer {
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #ffbe00;
  border-right-color: rgba(255,190,0,0.3);
  animation: ldSpin 1.4s linear infinite;
}
/* Inner spinning ring */
.ld-ring-inner {
  position: absolute; inset: 10px;
  border-radius: 50%;
  border: 1px solid transparent;
  border-bottom-color: #22d3ee;
  border-left-color: rgba(34,211,238,0.3);
  animation: ldSpin 1s linear infinite reverse;
}

/* Orbiting dot */
.ld-orbit-dot {
  position: absolute; inset: 0;
  animation: ldOrbit 2s linear infinite;
}
.ld-orbit-dot::after {
  content: '';
  position: absolute; top: 0; left: 50%;
  transform: translate(-50%,-50%);
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ffbe00;
  box-shadow: 0 0 10px rgba(255,190,0,0.8);
}

.ld-logo-img {
  width: 80px; height: 80px;
  border-radius: 50%;
  object-fit: cover;
  animation: ldFloat 3s ease-in-out infinite, ldGlow 2s ease-in-out infinite;
  position: relative; z-index: 1;
}

.ld-title {
  font-family: 'Orbitron', monospace;
  font-size: 26px; font-weight: 900;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #ffbe00, #f59e0b, #fde68a, #ffbe00);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 6px;
  animation: ldFadeUp 0.6s 0.2s ease both;
}

.ld-subtitle {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 32px;
  animation: ldFadeUp 0.6s 0.3s ease both;
}

/* Progress bar */
.ld-bar-wrap {
  width: 200px; height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px; overflow: hidden;
  margin-bottom: 16px;
  animation: ldFadeUp 0.6s 0.4s ease both;
}
.ld-bar-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #ffbe00, #22d3ee);
  box-shadow: 0 0 8px rgba(255,190,0,0.6);
  animation: ldBar 2.5s cubic-bezier(0.4,0,0.2,1) forwards;
}

/* Status dots */
.ld-dots {
  display: flex; gap: 6px;
  animation: ldFadeUp 0.6s 0.5s ease both;
}
.ld-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #ffbe00;
  animation: ldDot 1.2s ease-in-out infinite;
}
.ld-dot:nth-child(2) { animation-delay: 0.2s; }
.ld-dot:nth-child(3) { animation-delay: 0.4s; }

.ld-status {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 2px;
  color: rgba(255,255,255,0.2);
  margin-top: 12px;
  animation: ldFadeUp 0.6s 0.6s ease both, ldPulse 2s 0.6s ease-in-out infinite;
}

/* ── BAN SCREEN ── */
@keyframes bnShake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
@keyframes bnFlash  { 0%,100%{opacity:0} 50%{opacity:1} }
@keyframes bnFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes bnGlow   { 0%,100%{text-shadow:0 0 20px rgba(239,68,68,0.5)} 50%{text-shadow:0 0 40px rgba(239,68,68,0.9),0 0 80px rgba(239,68,68,0.3)} }
@keyframes bnScan   { 0%{top:-100%} 100%{top:200%} }

.bn-root {
  position: fixed; inset: 0;
  background: #06080f;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden; padding: 24px;
}
.bn-bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(239,68,68,0.03) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.bn-bg-glow {
  position: absolute; width: 500px; height: 500px;
  border-radius: 50%; top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  background: radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 65%);
  pointer-events: none;
}

/* Scanline effect */
.bn-scanline {
  position: absolute; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(239,68,68,0.3), transparent);
  animation: bnScan 3s linear infinite;
  pointer-events: none;
}

.bn-icon-wrap {
  position: relative;
  margin-bottom: 24px;
  animation: bnFadeUp 0.5s ease both;
}
.bn-gif {
  width: 140px; height: 140px;
  border-radius: 20px;
  border: 2px solid rgba(239,68,68,0.3);
  box-shadow: 0 0 40px rgba(239,68,68,0.2);
}
.bn-icon-ring {
  position: absolute; inset: -8px;
  border-radius: 26px;
  border: 1px solid rgba(239,68,68,0.15);
  animation: bnFlash 2s ease-in-out infinite;
}

.bn-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 14px; border-radius: 20px; margin-bottom: 14px;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  font-family: 'Orbitron', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 3px; color: #ef4444;
  animation: bnFadeUp 0.5s 0.1s ease both;
}
.bn-badge-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
  animation: ldDot 1.2s ease-in-out infinite;
}

.bn-title {
  font-family: 'Orbitron', monospace;
  font-size: 28px; font-weight: 900;
  letter-spacing: 2px; color: #ef4444;
  text-align: center; line-height: 1.1;
  margin-bottom: 8px;
  animation: bnFadeUp 0.5s 0.2s ease both, bnGlow 2s 0.5s ease-in-out infinite;
}

.bn-divider {
  width: 60px; height: 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  margin: 0 auto 14px;
  animation: bnFadeUp 0.5s 0.3s ease both;
}

.bn-msg {
  font-size: 14px; color: rgba(255,255,255,0.4);
  text-align: center; letter-spacing: 1px; line-height: 1.6;
  margin-bottom: 24px; max-width: 280px;
  animation: bnFadeUp 0.5s 0.4s ease both;
}

.bn-card {
  background: rgba(239,68,68,0.05);
  border: 1px solid rgba(239,68,68,0.15);
  border-radius: 16px; padding: 16px 20px;
  max-width: 300px; width: 100%;
  animation: bnFadeUp 0.5s 0.5s ease both;
}
.bn-card-title {
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 3px; color: rgba(239,68,68,0.5);
  text-transform: uppercase; margin-bottom: 10px;
}
.bn-card-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: rgba(255,255,255,0.3);
  letter-spacing: 0.5px; margin-bottom: 6px;
}
.bn-card-row:last-child { margin-bottom: 0; }
.bn-card-icon { font-size: 14px; flex-shrink: 0; }

.bn-support {
  margin-top: 20px;
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,255,255,0.1);
  text-align: center;
  animation: bnFadeUp 0.5s 0.6s ease both;
}

/* ── NOT TELEGRAM SCREEN ── */
@keyframes tgFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

.tg-root {
  position: fixed; inset: 0;
  background: #06080f;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 24px; text-align: center;
}
.tg-icon { font-size: 64px; margin-bottom: 20px; animation: tgFloat 3s ease-in-out infinite; }
.tg-title {
  font-family: 'Orbitron', monospace; font-size: 16px; font-weight: 900;
  letter-spacing: 2px; color: #fff; margin-bottom: 8px;
}
.tg-sub { font-size: 13px; color: rgba(255,255,255,0.3); letter-spacing: 1px; line-height: 1.6; }
`;

/* ── Loading screen ── */
function LoadingScreen() {
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    const msgs = [
      "Connecting to server...",
      "Loading your rewards...",
      "Preparing dashboard...",
      "Almost ready...",
    ];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % msgs.length;
      setStatus(msgs[i]);
    }, 700);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ld-root">
      <div className="ld-bg-grid" />
      <div className="ld-bg-glow1" />
      <div className="ld-bg-glow2" />

      {/* Logo */}
      <div className="ld-logo-wrap">
        <div className="ld-ring-outer" />
        <div className="ld-ring-inner" />
        <div className="ld-orbit-dot" />
        <img
          src="https://i.ibb.co/hJxry1hZ/53-AB4888-9018-455-D-B962-232-FAA620823.png"
          alt="Logo"
          className="ld-logo-img"
        />
      </div>

      <div className="ld-title">ADS REWARDS</div>
      <div className="ld-subtitle">Watch · Earn · Win</div>

      {/* Progress bar */}
      <div className="ld-bar-wrap">
        <div className="ld-bar-fill" />
      </div>

      {/* Dots */}
      <div className="ld-dots">
        <div className="ld-dot" />
        <div className="ld-dot" />
        <div className="ld-dot" />
      </div>

      <div className="ld-status">{status}</div>
    </div>
  );
}

/* ── Ban screen ── */
function BanScreen() {
  return (
    <div className="bn-root">
      <div className="bn-bg-grid" />
      <div className="bn-bg-glow" />
      <div className="bn-scanline" />

      <div className="bn-icon-wrap">
        <img
          src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773769725182-0fda5970.gif"
          alt="Banned"
          className="bn-gif"
        />
        <div className="bn-icon-ring" />
      </div>

      <div className="bn-badge">
        <div className="bn-badge-dot" />
        ACCESS REVOKED
      </div>

      <div className="bn-title">ACCOUNT<br/>SUSPENDED</div>
      <div className="bn-divider" />

      <div className="bn-msg">
        Your account has been suspended for violating our community guidelines.
      </div>

      <div className="bn-card">
        <div className="bn-card-title">Reason for suspension</div>
        <div className="bn-card-row">
          <span className="bn-card-icon">⚠️</span>
          Violation of Terms of Service
        </div>
        <div className="bn-card-row">
          <span className="bn-card-icon">🚫</span>
          Fraudulent activity detected
        </div>
        <div className="bn-card-row">
          <span className="bn-card-icon">📋</span>
          Multiple policy breaches
        </div>
      </div>

      <div className="bn-support">
        Contact support if you believe this is an error
      </div>
    </div>
  );
}

/* ── Not Telegram screen ── */
function NotTelegramScreen() {
  return (
    <div className="tg-root">
      <div className="tg-icon">✈️</div>
      <div className="tg-title">TELEGRAM ONLY</div>
      <div className="tg-sub">
        This app must be opened<br />
        inside Telegram as a Mini App
      </div>
    </div>
  );
}

/* ── Main app content ── */
function AppContent() {
  const { isLoading, user, isAdmin } = useApp();
  const [currentPage, setCurrentPage] = useState<Page>("home");

  const tg = (window as any)?.Telegram?.WebApp;
  const isTelegram =
    typeof window !== "undefined" && tg && tg.initDataUnsafe?.user;

  if (!isTelegram) return <NotTelegramScreen />;
  if (isLoading)   return <LoadingScreen />;
  if (user?.is_banned) return <BanScreen />;

  const renderPage = () => {
    switch (currentPage) {
      case "home":          return <HomePage />;
      case "tasks":         return <TasksPage />;
      case "spin":          return <SpinPage />;
      case "referral":      return <ReferralPage />;
      case "leaderboard":   return <LeaderboardPage />;
      case "wallet":        return <WalletPage />;
      case "notifications": return <NotificationsPage />;
      case "admin":         return isAdmin ? <AdminPanel /> : <HomePage />;
      case "games":         return <GamesPage onNavigate={setCurrentPage} />;
      case "tower":         return <TowerClimbPage />;
      case "luckybox":      return <LuckyBoxPage />;
      case "dice":          return <DiceRollPage />;
      case "cardflip":      return <CardFlipPage />;
      case "numberguess":   return <NumberGuessPage />;
      default:              return <HomePage />;
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        background: "#06080f",
      }}
    >
      {/* Ambient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          maxWidth: 480,
          zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,190,0,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 30% at 80% 80%, rgba(34,211,238,0.03) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 10% 60%, rgba(167,139,250,0.02) 0%, transparent 50%)
          `,
        }}
      />

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          maxWidth: 480,
          zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10">
        <Header />

        {/* Leaderboard quick nav */}
        {currentPage !== "leaderboard" && (
          <nav className="px-4 mb-2">
            <button
              onClick={() => setCurrentPage("leaderboard")}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                background: "rgba(255,190,0,0.06)",
                border: "1px solid rgba(255,190,0,0.2)",
                color: "rgba(255,190,0,0.6)",
                fontFamily: "'Orbitron', monospace",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "2px",
                cursor: "pointer",
              }}
            >
              🏆 LEADERBOARD
            </button>
          </nav>
        )}

        <main className="pt-1 pb-2">{renderPage()}</main>

        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <style>{GLOBAL_CSS}</style>
      <Toaster />
      <Sonner />
      <AppProvider>
        <AppContent />
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
