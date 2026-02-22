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

const queryClient = new QueryClient();

type Page = 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard' | 'wallet' | 'notifications' | 'admin';

function AppContent() {
  const { isLoading, user, isAdmin } = useApp();
  const [currentPage, setCurrentPage] = useState<Page>('home');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-float text-5xl mb-4">🎮</div>
        <div className="text-lg font-display font-bold shimmer-text">ADS REWARDS</div>
        <div className="text-xs text-muted-foreground mt-2">Loading your account...</div>
        <div className="mt-4 flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: 'hsl(45 100% 55%)',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'tasks': return <TasksPage />;
      case 'spin': return <SpinPage />;
      case 'referral': return <ReferralPage />;
      case 'leaderboard': return <LeaderboardPage />;
      case 'wallet': return <WalletPage />;
      case 'notifications': return <NotificationsPage />;
      case 'admin': return isAdmin ? <AdminPanel /> : <HomePage />;
      default: return <HomePage />;
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'radial-gradient(ellipse at top left, hsl(220 40% 8%) 0%, hsl(220 30% 3%) 60%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 80% 10%, hsl(265 80% 65% / 0.05) 0%, transparent 50%), radial-gradient(circle at 20% 80%, hsl(190 100% 55% / 0.05) 0%, transparent 50%)',
          maxWidth: 480,
          zIndex: 0,
        }}
      />

      <div className="relative z-10">
        <Header />
        
        {currentPage !== 'leaderboard' ? (
          <nav className="px-4 mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage('leaderboard')}
                className="px-3 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: 'hsl(220 25% 10%)',
                  border: '1px solid hsl(220 20% 15%)',
                  color: 'hsl(220 15% 60%)',
                }}
              >
                🏆 Leaderboard
              </button>
            </div>
          </nav>
        ) : null}

        <main className="pt-1 pb-2">
          {renderPage()}
        </main>

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
