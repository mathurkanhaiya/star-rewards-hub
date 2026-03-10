import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
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
  | "home"
  | "tasks"
  | "spin"
  | "referral"
  | "leaderboard"
  | "wallet"
  | "notifications"
  | "admin"
  | "games"
  | "tower"
  | "dice"
  | "cardflip"
  | "numberguess"
  | "luckybox";

function AppContent() {
  const { isLoading, user, isAdmin } = useApp();
  const [currentPage, setCurrentPage] = useState<Page>("home");

  // Loading screen
  if (isLoading) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">

      {/* Circular loading logo */}
      <div className="relative mb-6">
        <img
          src="https://i.ibb.co/hJxry1hZ/53-AB4888-9018-455-D-B962-232-FAA620823.png"
          alt="Loading"
          className="w-24 h-24 rounded-full animate-spin"
        />

        {/* glow ring */}
        <div className="absolute inset-0 rounded-full border-4 border-yellow-400/20 animate-pulse"></div>
      </div>

      <div className="text-lg font-display font-bold shimmer-text">
        ADS REWARDS
      </div>

      <div className="text-xs text-muted-foreground mt-2">
        Loading your account...
      </div>

      <div className="mt-4 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: "hsl(45 100% 55%)",
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

    </div>
  );
}

  // 🚫 BAN CHECK
  if (user?.is_banned) {
  const contactAdmin = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink("https://t.me/im_poorman");
    } else {
      window.open("https://t.me/im_poorman", "_blank");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative overflow-hidden">

      {/* background glow */}
      <div className="absolute inset-0 bg-red-500/10 blur-3xl animate-pulse"></div>

      {/* icon */}
      <div className="text-7xl mb-4 animate-bounce">🚫</div>

      {/* title */}
      <h1 className="text-3xl font-extrabold text-red-500 mb-2 animate-pulse">
        ACCOUNT BANNED
      </h1>

      {/* message */}
      <p className="text-sm text-gray-300 max-w-xs">
        Your account has been suspended for violating our platform rules.
      </p>

      {user?.ban_reason && (
        <p className="text-xs text-red-300 mt-3">
          Reason: {user.ban_reason}
        </p>
      )}

      {/* CONTACT BUTTON */}
      <button
        onClick={contactAdmin}
        className="mt-6 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition transform hover:scale-105 shadow-lg"
      >
        Contact Admin
      </button>

      <p className="text-xs text-gray-500 mt-4">
        If you believe this was a mistake, contact support.
      </p>

    </div>
  );
}
  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage />;
      case "tasks":
        return <TasksPage />;
      case "spin":
        return <SpinPage />;
      case "referral":
        return <ReferralPage />;
      case "leaderboard":
        return <LeaderboardPage />;
      case "wallet":
        return <WalletPage />;
      case "notifications":
        return <NotificationsPage />;
      case "admin":
        return isAdmin ? <AdminPanel /> : <HomePage />;
      case "games":
        return <GamesPage onNavigate={setCurrentPage} />;
      case "tower":
        return <TowerClimbPage />;
      case "luckybox":
        return <LuckyBoxPage />;
      case "dice":
        return <DiceRollPage />;
      case "cardflip":
        return <CardFlipPage />;
      case "numberguess":
        return <NumberGuessPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        background:
          "radial-gradient(ellipse at top left, hsl(220 40% 8%) 0%, hsl(220 30% 3%) 60%)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 10%, hsl(265 80% 65% / 0.05) 0%, transparent 50%), radial-gradient(circle at 20% 80%, hsl(190 100% 55% / 0.05) 0%, transparent 50%)",
          maxWidth: 480,
          zIndex: 0,
        }}
      />

      <div className="relative z-10">
        <Header />

        {currentPage !== "leaderboard" ? (
          <nav className="px-4 mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage("leaderboard")}
                className="px-3 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: "hsl(220 25% 10%)",
                  border: "1px solid hsl(220 20% 15%)",
                  color: "hsl(220 15% 60%)",
                }}
              >
                🏆 Leaderboard
              </button>
            </div>
          </nav>
        ) : null}

        <main className="pt-1 pb-2">{renderPage()}</main>

        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <AppContent />
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;