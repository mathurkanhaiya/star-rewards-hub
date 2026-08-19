import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
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
type Page = "home"|"tasks"|"spin"|"referral"|"leaderboard"|"wallet"|"notifications"|"admin";

const CSS=`
.app-shell{min-height:100vh;max-width:480px;margin:0 auto;position:relative;background:radial-gradient(circle at 12% 0%,rgba(90,120,255,.08),transparent 30%),radial-gradient(circle at 90% 20%,rgba(70,220,255,.05),transparent 32%)}
.app-loading,.app-banned{position:fixed;inset:0;display:grid;place-items:center;background:#06080f;color:#fff;z-index:200}.app-center{text-align:center;padding:28px}.app-loader{width:54px;height:54px;border-radius:50%;border:2px solid rgba(255,255,255,.1);border-top-color:#ffd84d;animation:appspin .9s linear infinite;margin:0 auto 18px}.app-brand{font:900 20px 'Orbitron',sans-serif;letter-spacing:3px;color:#ffd84d}.app-sub{font-size:10px;letter-spacing:2px;opacity:.4;margin-top:7px}.ban-icon{width:66px;height:66px;padding:16px;border-radius:22px;color:#f87171;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);margin:0 auto 16px}.ban-title{font:900 22px 'Orbitron',sans-serif;color:#f87171}.ban-copy{max-width:280px;font-size:13px;line-height:1.55;opacity:.55;margin:10px auto 0}@keyframes appspin{to{transform:rotate(360deg)}}`;

function AppContent(){
 const{isLoading,user,isAdmin}=useApp();const[currentPage,setCurrentPage]=useState<Page>('home');
 if(isLoading)return <><style>{CSS}</style><div className="app-loading"><div className="app-center"><div className="app-loader"/><div className="app-brand">ADS REWARDS</div><div className="app-sub">WATCH · EARN · WITHDRAW</div></div></div></>;
 if(user?.is_banned)return <><style>{CSS}</style><div className="app-banned"><div className="app-center"><ShieldAlert className="ban-icon"/><div className="ban-title">ACCOUNT SUSPENDED</div><div className="ban-copy">Your account is currently suspended. Contact support if you believe this is a mistake.</div></div></div></>;
 const render=()=>{switch(currentPage){case'home':return <HomePage/>;case'tasks':return <TasksPage/>;case'spin':return <SpinPage/>;case'referral':return <ReferralPage/>;case'leaderboard':return <LeaderboardPage/>;case'wallet':return <WalletPage/>;case'notifications':return <NotificationsPage/>;case'admin':return isAdmin?<AdminPanel/>:<HomePage/>;default:return <HomePage/>}};
 return <><style>{CSS}</style><div className="app-shell"><Header/>{render()}<BottomNav currentPage={currentPage} onNavigate={setCurrentPage}/></div></>;
}

export default function App(){return <QueryClientProvider client={queryClient}><TooltipProvider><AppProvider><AppContent/><Toaster/><Sonner/></AppProvider></TooltipProvider></QueryClientProvider>}
