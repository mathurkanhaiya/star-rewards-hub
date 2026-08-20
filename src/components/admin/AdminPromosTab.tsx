import React,{useEffect,useState}from'react';
import{adminCreatePromo,adminDeletePromo,adminGeneratePromoCode,adminGetPromos,adminUpdatePromo,type AdminPromo}from'@/lib/api';

interface Props{onMessage:(msg:string,type?:'success'|'error')=>void;}

const CSS=`
.adp-create,.adp-card{border-radius:18px;padding:14px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025)),rgba(10,15,27,.45);border:1px solid rgba(255,255,255,.08)}.adp-create{margin-bottom:12px}.adp-title{font-size:12px;font-weight:850;margin-bottom:10px}.adp-field{margin-bottom:8px}.adp-label{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;opacity:.42;margin-bottom:5px}.adp-input{width:100%;box-sizing:border-box;padding:10px 11px;border-radius:11px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.09);color:inherit;font-size:12px;outline:none}.adp-input:focus{border-color:rgba(255,216,77,.35)}.adp-code-row,.adp-two,.adp-actions{display:flex;gap:7px}.adp-code-row .adp-input{flex:1;min-width:0}.adp-generate,.adp-create-btn,.adp-action{border:0;border-radius:11px;font-weight:850;transition:transform .15s}.adp-generate:active,.adp-create-btn:active,.adp-action:active{transform:scale(.96)}.adp-generate{padding:0 11px;background:rgba(103,232,249,.1);border:1px solid rgba(103,232,249,.2);color:#a5f3fc;font-size:10px}.adp-two .adp-field{flex:1;min-width:0}.adp-create-btn{width:100%;padding:11px;margin-top:2px;background:linear-gradient(135deg,#ffd84d,#f59e0b);color:#171006;font-size:10px}.adp-create-btn:disabled,.adp-generate:disabled,.adp-action:disabled{opacity:.42}.adp-card{margin-bottom:8px}.adp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.adp-code{font:900 14px 'Orbitron',sans-serif;letter-spacing:1.4px;color:#ffe08a}.adp-meta{font-size:10px;opacity:.48;margin-top:4px;line-height:1.5}.adp-status{font-size:8px;font-weight:850;padding:4px 7px;border-radius:999px;white-space:nowrap}.adp-status.on{background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.22)}.adp-status.off{background:rgba(148,163,184,.1);color:#cbd5e1;border:1px solid rgba(148,163,184,.18)}.adp-expired{color:#fca5a5}.adp-actions{margin-top:10px}.adp-action{flex:1;padding:8px;font-size:9px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);color:inherit}.adp-action.danger{flex:0 0 42px;color:#fca5a5;border-color:rgba(239,68,68,.18);background:rgba(239,68,68,.08)}.adp-empty{text-align:center;padding:28px 10px;opacity:.42;font-size:12px}[data-theme='light'] .adp-create,[data-theme='light'] .adp-card{background:rgba(255,255,255,.92);border-color:rgba(15,23,42,.08);color:#0f172a}[data-theme='light'] .adp-input{background:rgba(15,23,42,.035);border-color:rgba(15,23,42,.1);color:#0f172a}[data-theme='light'] .adp-code{color:#9a6300}`;

export default function AdminPromosTab({onMessage}:Props){
 const[promos,setPromos]=useState<AdminPromo[]>([]);
 const[code,setCode]=useState('');
 const[reward,setReward]=useState('100');
 const[maxClaims,setMaxClaims]=useState('100');
 const[expiry,setExpiry]=useState('');
 const[busy,setBusy]=useState<string|null>(null);

 async function load(){setPromos(await adminGetPromos())}
 useEffect(()=>{void load()},[]);

 async function generate(){
  setBusy('generate');
  const r=await adminGeneratePromoCode();
  if(r.success&&r.code)setCode(r.code);else onMessage(r.message||'Could not generate code','error');
  setBusy(null);
 }

 async function create(){
  const clean=code.trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{7,8}$/.test(clean)){onMessage('Use a 7–8 character promo code (A–Z, 2–9)','error');return;}
  const rewardPoints=Math.max(0,Math.floor(Number(reward)));
  const limit=Math.max(1,Math.floor(Number(maxClaims)));
  setBusy('create');
  const r:any=await adminCreatePromo({code:clean,rewardPoints,maxClaims:limit,expiresAt:expiry?new Date(expiry).toISOString():null,isActive:true});
  if(r.success){onMessage('Promo created ✓');setCode('');setExpiry('');await load();}
  else onMessage(r.message||'Failed to create promo','error');
  setBusy(null);
 }

 async function toggle(p:AdminPromo){
  setBusy(p.id);
  const r:any=await adminUpdatePromo(p.id,{isActive:!p.is_active});
  onMessage(r.success?(p.is_active?'Promo disabled':'Promo enabled'):(r.message||'Update failed'),r.success?'success':'error');
  if(r.success)await load();
  setBusy(null);
 }

 async function remove(p:AdminPromo){
  if(!window.confirm(`Delete promo ${p.code}?`))return;
  setBusy(p.id);
  const r:any=await adminDeletePromo(p.id);
  onMessage(r.success?'Promo deleted':(r.message||'Delete failed'),r.success?'success':'error');
  if(r.success)await load();
  setBusy(null);
 }

 return <div><style>{CSS}</style>
  <section className="adp-create">
   <div className="adp-title">🎁 Create Promo Code</div>
   <div className="adp-field"><div className="adp-label">Promo code</div><div className="adp-code-row"><input className="adp-input" value={code} maxLength={8} placeholder="Custom 7–8 character code" onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))}/><button className="adp-generate" disabled={busy!==null} onClick={()=>void generate()}>{busy==='generate'?'…':'Generate'}</button></div></div>
   <div className="adp-two"><div className="adp-field"><div className="adp-label">ADR reward</div><input className="adp-input" type="number" min="0" value={reward} onChange={e=>setReward(e.target.value)}/></div><div className="adp-field"><div className="adp-label">Claim limit</div><input className="adp-input" type="number" min="1" value={maxClaims} onChange={e=>setMaxClaims(e.target.value)}/></div></div>
   <div className="adp-field"><div className="adp-label">Expiry (optional)</div><input className="adp-input" type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div>
   <button className="adp-create-btn" disabled={busy!==null||!code.trim()} onClick={()=>void create()}>{busy==='create'?'Creating…':'Create Promo'}</button>
  </section>

  {promos.map(p=>{const expired=Boolean(p.expires_at&&new Date(p.expires_at).getTime()<=Date.now());return <section className="adp-card" key={p.id}><div className="adp-head"><div><div className="adp-code">{p.code}</div><div className="adp-meta">🎁 {Number(p.reward_points).toLocaleString()} ADR · {p.total_claimed}/{p.max_claims} claims<br/>{p.expires_at?<span className={expired?'adp-expired':''}>{expired?'Expired':'Expires'} {new Date(p.expires_at).toLocaleString()}</span>:'No expiry'}</div></div><span className={`adp-status ${p.is_active?'on':'off'}`}>{p.is_active?'ENABLED':'DISABLED'}</span></div><div className="adp-actions"><button className="adp-action" disabled={busy===p.id} onClick={()=>void toggle(p)}>{p.is_active?'Disable':'Enable'}</button><button className="adp-action danger" disabled={busy===p.id} onClick={()=>void remove(p)}>🗑️</button></div></section>})}
  {!promos.length?<div className="adp-empty">No promo codes yet</div>:null}
 </div>;
}
