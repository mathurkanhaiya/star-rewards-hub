import React, { useState, useMemo } from 'react';

interface WithdrawalItem {
  id: string;
  method: string;
  points_spent: number;
  amount: number;
  status: string;
  wallet_address: string | null;
  created_at: string;
  admin_note: string | null;
  users: { first_name: string; username: string; telegram_id: number; photo_url: string | null } | null;
}

interface Props {
  withdrawals: WithdrawalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const STATUS_CONFIG = {
  pending:  { color: '#ffbe00', glow: 'rgba(255,190,0,0.4)',  bg: 'rgba(255,190,0,0.08)',  border: 'rgba(255,190,0,0.25)',  label: 'PENDING'  },
  approved: { color: '#4ade80', glow: 'rgba(74,222,128,0.4)', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', label: 'APPROVED' },
  rejected: { color: '#ef4444', glow: 'rgba(239,68,68,0.4)',  bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  label: 'REJECTED' },
};

/* Convert TON to nanotons for Tonkeeper URL */
function toNanoton(amount: number): string {
  return Math.round(amount * 1e9).toString();
}

function buildTonkeeperUrl(wallet: string, amount: number): string {
  return `https://app.tonkeeper.com/transfer/${wallet}?amount=${toNanoton(amount)}&text=AdsRewartsBot`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes awFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes awShine  { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes awPulse  { 0%,100%{opacity:0.7} 50%{opacity:1} }

.aw-root { font-family:'Rajdhani',sans-serif; color:#fff; }

/* Summary */
.aw-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
.aw-summary-tile { border-radius:16px; padding:14px 10px; text-align:center; position:relative; overflow:hidden; }
.aw-summary-val   { font-family:'Orbitron',monospace; font-size:26px; font-weight:900; line-height:1; margin-bottom:3px; }
.aw-summary-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }

/* Filter */
.aw-filters { display:flex; gap:6px; margin-bottom:14px; }
.aw-filter-btn { flex:1; padding:7px; border-radius:12px; border:none; font-family:'Orbitron',monospace; font-size:8px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all 0.2s; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.25); }

/* Card */
.aw-card { background:rgba(255,255,255,0.02); border-radius:18px; margin-bottom:8px; overflow:hidden; position:relative; animation:awFadeIn 0.3s ease both; }
.aw-card-beam { position:absolute; top:0; left:10%; right:10%; height:1px; pointer-events:none; }
.aw-card-body { padding:14px 16px; }

/* User row */
.aw-user-row  { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.aw-avatar    { width:42px; height:42px; border-radius:50%; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:16px; font-family:'Orbitron',monospace; font-weight:700; }
.aw-avatar img{ width:100%; height:100%; object-fit:cover; }
.aw-user-info { flex:1; min-width:0; }
.aw-user-name { font-size:14px; font-weight:700; color:rgba(255,255,255,0.9); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.aw-username  { color:rgba(255,255,255,0.3); font-weight:500; font-size:13px; }
.aw-user-meta { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; margin-top:2px; }
.aw-status-badge { font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:2px; padding:4px 10px; border-radius:20px; flex-shrink:0; }

/* Amount */
.aw-amount-row { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:10px 14px; margin-bottom:10px; }
.aw-pts   { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; color:rgba(255,255,255,0.5); }
.aw-arrow { color:rgba(255,255,255,0.2); font-size:14px; }
.aw-ton   { font-family:'Orbitron',monospace; font-size:18px; font-weight:900; letter-spacing:1px; }
.aw-method-tag { margin-left:auto; font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:2px; padding:3px 8px; border-radius:6px; background:rgba(34,211,238,0.1); border:1px solid rgba(34,211,238,0.2); color:#22d3ee; }

/* Wallet */
.aw-wallet { display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:8px 12px; margin-bottom:10px; }
.aw-wallet-icon { font-size:14px; flex-shrink:0; }
.aw-wallet-addr { font-family:'Rajdhani',sans-serif; font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
.aw-copy-btn { background:none; border:none; cursor:pointer; font-size:12px; color:rgba(255,255,255,0.3); padding:0; transition:color 0.2s; flex-shrink:0; }
.aw-copy-btn:hover { color:#22d3ee; }

/* Note */
.aw-note { display:flex; align-items:flex-start; gap:6px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); border-radius:10px; padding:8px 12px; margin-bottom:10px; font-size:12px; color:rgba(255,255,255,0.4); line-height:1.4; }

/* Time */
.aw-time { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:1px; color:rgba(255,255,255,0.15); margin-bottom:10px; }

/* Actions */
.aw-actions { display:flex; flex-direction:column; gap:8px; }
.aw-actions-row { display:flex; gap:8px; }

.aw-btn {
  flex:1; padding:12px; border-radius:12px; border:none;
  font-family:'Orbitron',monospace; font-size:11px; font-weight:700;
  letter-spacing:1px; cursor:pointer; transition:transform 0.12s,box-shadow 0.2s;
  position:relative; overflow:hidden;
}
.aw-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); animation:awShine 3s ease-in-out infinite; }
.aw-btn:active { transform:scale(0.97); }

.aw-btn-approve {
  background:linear-gradient(135deg,#4ade80,#16a34a);
  color:#001a0a; box-shadow:0 4px 16px rgba(74,222,128,0.3);
}
.aw-btn-reject {
  background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444;
}
.aw-btn-reject::after { display:none; }

/* ── Tonkeeper pay button ── */
.aw-btn-tonkeeper {
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px; border: none;
  background: linear-gradient(135deg, #0098ea, #006bcc);
  color: #fff;
  font-family: 'Orbitron', monospace;
  font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(0,152,234,0.35);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none;
  position: relative; overflow: hidden;
}
.aw-btn-tonkeeper::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: awShine 3s ease-in-out infinite;
}
.aw-btn-tonkeeper:active { transform: scale(0.97); }
.aw-btn-tonkeeper-icon { font-size: 18px; line-height: 1; }
.aw-btn-tonkeeper-amount {
  font-size: 10px; opacity: 0.75; letter-spacing: 1px;
  margin-left: 2px;
}

/* Approved pay indicator */
.aw-paid-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 12px;
  background: rgba(0,152,234,0.08); border: 1px solid rgba(0,152,234,0.2);
  font-family: 'Orbitron', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 2px; color: #0098ea;
}

/* Empty */
.aw-empty { text-align:center; padding:48px 0; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.1); text-transform:uppercase; }
`;

export default function AdminWithdrawalsTab({ withdrawals, onApprove, onReject }: Props) {
  const [filter, setFilter]   = useState<'all'|'pending'|'approved'|'rejected'>('all');
  const [copied, setCopied]   = useState<string | null>(null);

  const counts = useMemo(() => ({
    pending:  withdrawals.filter(w => w.status === 'pending').length,
    approved: withdrawals.filter(w => w.status === 'approved').length,
    rejected: withdrawals.filter(w => w.status === 'rejected').length,
  }), [withdrawals]);

  const filtered = useMemo(() =>
    filter === 'all' ? withdrawals : withdrawals.filter(w => w.status === filter),
    [withdrawals, filter]
  );

  const totalTon = useMemo(() =>
    withdrawals.filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount), 0),
    [withdrawals]
  );

  function copyWallet(addr: string) {
    try {
      navigator.clipboard.writeText(addr);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = addr; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }

  function openTonkeeper(wallet: string, amount: number) {
    const url = buildTonkeeperUrl(wallet, amount);
    /* Open in Telegram WebApp browser or fallback */
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="aw-root">

        {/* Summary tiles */}
        <div className="aw-summary">
          {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG['pending']][]).map(([key, sc]) => (
            <div key={key} className="aw-summary-tile"
              style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
              <div style={{
                position:'absolute', top:0, left:'10%', right:'10%', height:'1px',
                background:`linear-gradient(90deg,transparent,${sc.color}50,transparent)`,
              }}/>
              <div className="aw-summary-val" style={{ color: sc.color }}>
                {counts[key as keyof typeof counts]}
              </div>
              <div className="aw-summary-label">{sc.label}</div>
            </div>
          ))}
        </div>

        {/* Total approved banner */}
        {totalTon > 0 && (
          <div style={{
            background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.15)',
            borderRadius:'14px', padding:'10px 16px', marginBottom:'14px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, letterSpacing:'2px', color:'rgba(255,255,255,0.25)', textTransform:'uppercase' }}>
              Total Approved
            </div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:700, color:'#22d3ee', letterSpacing:'1px' }}>
              {totalTon.toFixed(2)} TON
            </div>
          </div>
        )}

        {/* Filter strip */}
        <div className="aw-filters">
          {(['all','pending','approved','rejected'] as const).map(f => {
            const sc = f === 'all' ? null : STATUS_CONFIG[f];
            const isActive = filter === f;
            return (
              <button key={f} className="aw-filter-btn" onClick={() => setFilter(f)}
                style={isActive ? {
                  background: sc ? sc.bg : 'rgba(255,255,255,0.06)',
                  borderColor: sc ? sc.border : 'rgba(255,255,255,0.2)',
                  color: sc ? sc.color : '#fff',
                  boxShadow: sc ? `0 0 12px ${sc.glow}20` : 'none',
                } : {}}>
                {f === 'all' ? `ALL (${withdrawals.length})` : `${f.toUpperCase()} (${counts[f]})`}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="aw-empty">✦ No withdrawals found ✦</div>
        )}

        {filtered.map((w, idx) => {
          const sc = STATUS_CONFIG[w.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
          const isTon = w.method?.toLowerCase() === 'ton';
          const hasWallet = !!w.wallet_address;

          return (
            <div key={w.id} className="aw-card"
              style={{ border:`1px solid ${sc.color}15`, animationDelay:`${idx * 0.04}s` }}>
              <div className="aw-card-beam"
                style={{ background:`linear-gradient(90deg,transparent,${sc.color}30,transparent)` }}/>

              <div className="aw-card-body">

                {/* User row */}
                <div className="aw-user-row">
                  <div className="aw-avatar"
                    style={{ background:`${sc.color}12`, border:`2px solid ${sc.color}30` }}>
                    {w.users?.photo_url
                      ? <img src={w.users.photo_url} alt="" className="clickable"/>
                      : <span style={{ color: sc.color }}>{w.users?.first_name?.[0] || '?'}</span>}
                  </div>
                  <div className="aw-user-info">
                    <div className="aw-user-name">
                      {w.users?.first_name || 'User'}
                      {w.users?.username && <span className="aw-username">@{w.users.username}</span>}
                    </div>
                    <div className="aw-user-meta">TG: {w.users?.telegram_id || '—'}</div>
                  </div>
                  <div className="aw-status-badge"
                    style={{ background: sc.bg, border:`1px solid ${sc.border}`, color: sc.color }}>
                    {sc.label}
                  </div>
                </div>

                {/* Amount */}
                <div className="aw-amount-row">
                  <div className="aw-pts">{w.points_spent.toLocaleString()} PTS</div>
                  <div className="aw-arrow">→</div>
                  <div className="aw-ton" style={{ color: sc.color }}>
                    {Number(w.amount).toFixed(2)}
                  </div>
                  <div className="aw-method-tag">{w.method.toUpperCase()}</div>
                </div>

                {/* Wallet */}
                {hasWallet && (
                  <div className="aw-wallet">
                    <span className="aw-wallet-icon">💳</span>
                    <span className="aw-wallet-addr">{w.wallet_address}</span>
                    <button className="aw-copy-btn"
                      onClick={() => copyWallet(w.wallet_address!)}
                      title="Copy address">
                      {copied === w.wallet_address ? '✓' : '📋'}
                    </button>
                  </div>
                )}

                {/* Admin note */}
                {w.admin_note && (
                  <div className="aw-note">
                    <span>⚠️</span><span>{w.admin_note}</span>
                  </div>
                )}

                {/* Time */}
                <div className="aw-time">
                  📅 {new Date(w.created_at).toLocaleDateString('en-US', {
                    month:'short', day:'numeric', year:'numeric',
                    hour:'2-digit', minute:'2-digit',
                  })}
                  &nbsp;·&nbsp;{timeAgo(w.created_at)}
                </div>

                {/* ── ACTIONS ── */}
                <div className="aw-actions">

                  {/* Pending — show Tonkeeper + approve + reject */}
                  {w.status === 'pending' && (
                    <>
                      {/* Tonkeeper pay button — only for TON with wallet */}
                      {isTon && hasWallet && (
                        <button
                          className="aw-btn-tonkeeper"
                          onClick={() => openTonkeeper(w.wallet_address!, Number(w.amount))}
                        >
                          <span className="aw-btn-tonkeeper-icon">💎</span>
                          PAY WITH TONKEEPER
                          <span className="aw-btn-tonkeeper-amount">
                            {Number(w.amount).toFixed(2)} TON
                          </span>
                        </button>
                      )}

                      {/* Approve + Reject */}
                      <div className="aw-actions-row">
                        <button className="aw-btn aw-btn-approve" onClick={() => onApprove(w.id)}>
                          ✓ APPROVE
                        </button>
                        <button className="aw-btn aw-btn-reject" onClick={() => onReject(w.id)}>
                          ✗ REJECT
                        </button>
                      </div>
                    </>
                  )}

                  {/* Approved — show Tonkeeper as a pay-again reference */}
                  {w.status === 'approved' && isTon && hasWallet && (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <div className="aw-paid-badge">
                        ✓ PAYMENT APPROVED
                      </div>
                      <button
                        className="aw-btn-tonkeeper"
                        style={{ flex:1, padding:'10px 12px', fontSize:10 }}
                        onClick={() => openTonkeeper(w.wallet_address!, Number(w.amount))}
                      >
                        <span className="aw-btn-tonkeeper-icon">💎</span>
                        OPEN TONKEEPER
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}
