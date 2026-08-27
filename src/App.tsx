import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageCircle, ShieldAlert, Wrench } from "lucide-react";
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
.app-shell{min-height:100vh;max-width:480px;margin:0 auto;position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(circle at 12% 0%,rgba(90,120,255,.08),transparent 30%),radial-gradient(circle at 90% 20%,rgba(70,220,255,.05),transparent 32%)}.app-shell::before,.app-shell::after{content:'';position:fixed;width:230px;height:230px;border-radius:50%;filter:blur(70px);opacity:.12;z-index:-1;pointer-events:none;animation:appdrift 9s ease-in-out infinite}.app-shell::before{left:-130px;top:16%;background:#556dff}.app-shell::after{right:-140px;top:54%;background:#22d3ee;animation-delay:-4.5s}.app-page{position:relative;animation:apppage .42s cubic-bezier(.2,.75,.2,1) both}
.app-loading,.app-banned,.app-maintenance{position:fixed;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,#151a2b 0,#080b14 34%,#05070d 72%);color:#fff;z-index:200;overflow:hidden}.app-center{text-align:center;padding:28px;position:relative}.app-loader-stage{width:132px;height:132px;position:relative;margin:0 auto 22px;display:grid;place-items:center}.app-logo-wrap{width:106px;height:106px;border-radius:28px;display:grid;place-items:center;padding:8px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 46px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(18px);animation:applogo 1.8s ease-in-out infinite}.app-logo{width:100%;height:100%;object-fit:contain;border-radius:22px;display:block}.app-brand{font:900 20px 'Orbitron',sans-serif;letter-spacing:3px;color:#ffd84d;animation:appreveal .65s .12s both}.app-sub{font-size:10px;letter-spacing:2px;opacity:.42;margin-top:7px;animation:appreveal .65s .22s both}.app-progress{width:150px;height:3px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:18px auto 0}.app-progress::after{content:'';display:block;width:45%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,#ffd84d,#67e8f9,transparent);animation:appload 1.25s ease-in-out infinite}.gate-icon{width:66px;height:66px;padding:16px;border-radius:22px;margin:0 auto 16px}.ban-icon{color:#f87171;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22)}.maintenance-icon{color:#facc15;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.22)}.gate-title{font:900 20px 'Orbitron',sans-serif;letter-spacing:.4px}.ban-title{color:#f87171}.maintenance-title{color:#fde68a}.gate-copy{max-width:310px;font-size:13px;line-height:1.6;opacity:.66;margin:10px auto 0}.gate-reason{max-width:310px;margin:14px auto 0;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.45}.gate-button{margin:16px auto 0;border:0;border-radius:13px;padding:11px 16px;display:inline-flex;align-items:center;gap:7px;background:rgba(103,232,249,.1);border:1px solid rgba(103,232,249,.22);color:#a5f3fc;font-weight:800}.gate-button svg{width:16px;height:16px}
@keyframes applogo{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.025)}}@keyframes appreveal{from{opacity:0;transform:translateY(8px);letter-spacing:6px}to{opacity:1;transform:none}}@keyframes appload{from{transform:translateX(-120%)}to{transform:translateX(330%)}}@keyframes apppage{from{opacity:0;transform:translateY(10px) scale(.992)}to{opacity:1;transform:none}}@keyframes appdrift{50%{transform:translate3d(24px,-34px,0) scale(1.12)}}
@media(prefers-reduced-motion:reduce){.app-shell::before,.app-shell::after,.app-page,.app-logo-wrap,.app-brand,.app-sub,.app-progress::after{animation-duration:.01ms!important;animation-iteration-count:1!important}}`;

const on=(value:unknown)=>!['false','0','off','no',''].includes(String(value??'').trim().toLowerCase());
const ADR_LABEL=/\b(?:points?|pts)\b/gi;
function adrLabel(value:string){return value.replace(ADR_LABEL,'ADR')}
function normalizeAdrUi(root:Node){
  if(root.nodeType===Node.TEXT_NODE){
    const parent=(root.parentElement?.tagName||'').toUpperCase();
    if(parent!=='STYLE'&&parent!=='SCRIPT'&&parent!=='CODE'){
      const before=root.nodeValue||'';const after=adrLabel(before);if(after!==before)root.nodeValue=after;
    }
    return;
  }
  if(root instanceof Element){
    for(const attr of ['placeholder','title','aria-label']){
      const before=root.getAttribute(attr);if(before){const after=adrLabel(before);if(after!==before)root.setAttribute(attr,after);}
    }
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
    const parent=(node.parentElement?.tagName||'').toUpperCase();
    if(parent==='STYLE'||parent==='SCRIPT'||parent==='CODE')continue;
    const before=node.nodeValue||'';const after=adrLabel(before);if(after!==before)node.nodeValue=after;
  }
  if(root instanceof Element){
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
      for(const attr of ['placeholder','title','aria-label']){const before=el.getAttribute(attr);if(before){const after=adrLabel(before);if(after!==before)el.setAttribute(attr,after);}}
    });
  }
}

function AppContent(){
 const{isLoading,user,isAdmin,settings}=useApp();const[currentPage,setCurrentPage]=useState<Page>('home');
 useEffect(()=>{
  normalizeAdrUi(document.body);
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')normalizeAdrUi(record.target);record.addedNodes.forEach(normalizeAdrUi);if(record.type==='attributes')normalizeAdrUi(record.target);}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  return()=>observer.disconnect();
 },[]);
 if(isLoading)return <><style>{CSS}</style><div className="app-loading"><div className="app-center" role="status" aria-label="Loading Ads Rewards"><div className="app-loader-stage"><div className="app-logo-wrap"><img className="app-logo" src="https://pixlinkhost.vercel.app/i/Hi5igH-F5g" alt="Ads Rewards logo"/></div></div><div className="app-brand">ADS REWARDS</div><div className="app-sub">WATCH · EARN · WITHDRAW</div><div className="app-progress"/></div></div></>;
 if(user?.is_banned){
  const support=String(user.support_username||settings.support_username||'').trim().replace(/^@/,'');
  return <><style>{CSS}</style><div className="app-banned"><div className="app-center"><ShieldAlert className="gate-icon ban-icon"/><div className="gate-title ban-title">🚫 Account Restricted</div><div className="gate-copy">Your AdsReward account has been banned.</div><div className="gate-reason"><strong>Reason:</strong> {user.ban_reason||'No reason provided.'}</div>{support?<button className="gate-button" onClick={()=>window.Telegram?.WebApp?.openTelegramLink(`https://t.me/${support}`)}><MessageCircle/>Contact Support</button>:null}</div></div></>;
 }
 if(on(settings.maintenance_mode)&&!isAdmin)return <><style>{CSS}</style><div className="app-maintenance"><div className="app-center"><Wrench className="gate-icon maintenance-icon"/><div className="gate-title maintenance-title">🛠 AdsReward Maintenance</div><div className="gate-copy">We're currently improving AdsReward.<br/><br/>Your balance and progress remain saved. Please check again later.</div></div></div></>;
 const render=()=>{switch(currentPage){case'home':return <HomePage/>;case'tasks':return <TasksPage/>;case'spin':return <SpinPage/>;case'referral':return <ReferralPage/>;case'leaderboard':return <LeaderboardPage/>;case'wallet':return <WalletPage/>;case'notifications':return <NotificationsPage/>;case'admin':return isAdmin?<AdminPanel/>:<HomePage/>;default:return <HomePage/>}};
 return <><style>{CSS}</style><div className="app-shell"><Header/><main className="app-page" key={currentPage}>{render()}</main><BottomNav currentPage={currentPage} onNavigate={setCurrentPage}/></div></>;
}

export default function App(){return <QueryClientProvider client={queryClient}><TooltipProvider><AppProvider><AppContent/><Toaster/><Sonner/></AppProvider></TooltipProvider></QueryClientProvider>}
