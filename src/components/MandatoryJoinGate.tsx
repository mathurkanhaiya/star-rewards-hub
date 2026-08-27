import { CheckCircle2, ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';
import type { MandatoryJoinChannel } from '@/lib/mandatoryJoinApi';

const CSS=`
.mj-gate{position:fixed;inset:0;z-index:210;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 35%,#151a2b 0,#080b14 38%,#05070d 75%);color:#fff}.mj-box{width:min(100%,390px)}.mj-logo{width:82px;height:82px;margin:0 auto 16px;border-radius:24px;padding:7px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09)}.mj-logo img{width:100%;height:100%;object-fit:contain;border-radius:18px}.mj-kicker{text-align:center;font:800 9px 'Orbitron',sans-serif;letter-spacing:2.2px;color:#ffd84d}.mj-title{text-align:center;font:900 22px 'Orbitron',sans-serif;margin-top:6px}.mj-copy{text-align:center;font-size:12px;line-height:1.55;opacity:.52;margin:8px auto 16px;max-width:290px}.mj-list{display:grid;gap:9px}.mj-card{display:flex;align-items:center;gap:11px;padding:12px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(18px)}.mj-avatar{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;overflow:hidden;background:rgba(255,216,77,.09);border:1px solid rgba(255,216,77,.16);flex:0 0 46px}.mj-avatar img{width:100%;height:100%;object-fit:cover}.mj-avatar svg{width:21px;color:#ffd84d}.mj-main{min-width:0;flex:1}.mj-name{font-size:13px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mj-status{font-size:9px;opacity:.42;margin-top:3px}.mj-join{border:0;border-radius:12px;min-width:76px;min-height:39px;padding:0 10px;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#ffd84d,#f59e0b);color:#171006;font:800 9px 'Orbitron',sans-serif}.mj-join svg{width:14px}.mj-joined{color:#86efac}.mj-wait{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:14px;font-size:10px;opacity:.48}.mj-wait svg{width:14px;animation:mjspin 1s linear infinite}@keyframes mjspin{to{transform:rotate(360deg)}}
`;

export default function MandatoryJoinGate({channels,checking,onOpen}:{channels:MandatoryJoinChannel[];checking:boolean;onOpen:(channel:MandatoryJoinChannel)=>void}){
 return <><style>{CSS}</style><div className="mj-gate"><div className="mj-box">
  <div className="mj-logo"><img src="https://pixlinkhost.vercel.app/i/Hi5igH-F5g" alt="Ads Rewards logo"/></div>
  <div className="mj-kicker">ACCESS REQUIRED</div><div className="mj-title">Join to continue</div>
  <div className="mj-copy">Join the required Telegram channels. Access unlocks automatically when membership is detected.</div>
  <div className="mj-list">{channels.map(channel=><div className="mj-card" key={channel.id}>
   <div className="mj-avatar">{channel.imageUrl?<img src={channel.imageUrl} alt=""/>:<ShieldCheck/>}</div>
   <div className="mj-main"><div className="mj-name">{channel.title}</div><div className={`mj-status ${channel.isJoined?'mj-joined':''}`}>{channel.isJoined?'Joined':channel.error?'Checking unavailable':'Not joined'}</div></div>
   {channel.isJoined?<CheckCircle2 className="mj-joined"/>:<button className="mj-join" onClick={()=>onOpen(channel)}><ExternalLink/>JOIN</button>}
  </div>)}</div>
  <div className="mj-wait">{checking?<><LoaderCircle/>Checking membership…</>:<>Return here after joining — verification is automatic.</>}</div>
 </div></div></>;
}
