import React from "react";
import { useApp } from "@/context/AppContext";
import { Crown, Gem, Sparkles } from "lucide-react";

function getLevelInfo(level: number) {
  const levels = [
    { name: "Beginner", color: "#60a5fa", min: 1, max: 2 },
    { name: "Rookie", color: "#818cf8", min: 3, max: 4 },
    { name: "Iron", color: "#94a3b8", min: 5, max: 6 },
    { name: "Bronze", color: "#f97316", min: 7, max: 9 },
    { name: "Silver", color: "#e2e8f0", min: 10, max: 13 },
    { name: "Gold", color: "#ffd45c", min: 14, max: 18 },
    { name: "Platinum", color: "#22d3ee", min: 19, max: 24 },
    { name: "Diamond", color: "#c084fc", min: 25, max: 35 },
    { name: "Master", color: "#a855f7", min: 36, max: 50 },
    { name: "LEGEND", color: "#fb7185", min: 51, max: 99 },
  ];
  return levels.find((l) => level >= l.min && level <= l.max) || levels[0];
}

const CSS = `
.hdr-root { padding: 12px 14px 8px; }
.hdr-shell {
  position: relative;
  overflow: hidden;
  border-radius: 25px;
  padding: 12px 13px 10px;
  background: linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.035)),rgba(10,15,27,.48);
  border: 1px solid rgba(255,255,255,.13);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.17),0 18px 45px rgba(0,0,0,.27);
  backdrop-filter: blur(26px) saturate(150%);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
}
.hdr-shell::before {
  content:''; position:absolute; width:170px; height:110px; right:-50px; top:-55px; border-radius:50%;
  background:radial-gradient(circle,rgba(110,140,255,.2),transparent 68%); pointer-events:none;
}
.hdr-row { position:relative; z-index:1; display:flex; align-items:center; gap:10px; }
.hdr-avatar-wrap { position:relative; flex-shrink:0; }
.hdr-avatar {
  width:45px; height:45px; border-radius:16px; overflow:hidden; display:grid; place-items:center;
  background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.04));
  border:1px solid rgba(255,255,255,.16); box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 20px rgba(0,0,0,.24);
  font:700 16px 'Orbitron',sans-serif;
}
.hdr-avatar img { width:100%; height:100%; object-fit:cover; }
.hdr-level-badge {
  position:absolute; right:-4px; bottom:-4px; min-width:19px; height:19px; padding:0 4px; border-radius:8px;
  display:grid; place-items:center; color:#070b12; border:2px solid #090d17; font:700 8px 'Orbitron',sans-serif;
}
.hdr-name-block { min-width:0; flex:1; }
.hdr-name { color:rgba(255,255,255,.94); font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hdr-username { color:rgba(255,255,255,.35); font-size:11px; font-weight:500; }
.hdr-level-label { margin-top:3px; display:flex; align-items:center; gap:4px; font-size:9px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; }
.hdr-level-label svg { width:12px; height:12px; }
.hdr-points {
  flex-shrink:0; display:flex; align-items:center; gap:7px; padding:8px 10px; border-radius:15px;
  background:linear-gradient(145deg,rgba(255,214,92,.16),rgba(255,190,0,.06));
  border:1px solid rgba(255,215,100,.22); box-shadow:inset 0 1px 0 rgba(255,255,255,.16);
}
.hdr-points svg { width:15px; height:15px; color:#ffd45c; filter:drop-shadow(0 0 6px rgba(255,190,0,.25)); }
.hdr-points-val { color:#ffe38e; font:700 12px 'Orbitron',sans-serif; }
.hdr-brand {
  position:relative; z-index:1; margin-top:10px; padding-top:9px; border-top:1px solid rgba(255,255,255,.075);
  display:flex; align-items:center; justify-content:space-between;
}
.hdr-brand-left { display:flex; align-items:center; gap:7px; }
.hdr-brand-left svg { width:14px; height:14px; color:#ffd45c; }
.hdr-title { font:700 10px 'Orbitron',sans-serif; letter-spacing:2.4px; color:rgba(255,255,255,.54); }
.hdr-title b { color:#ffd45c; font-weight:800; }
.hdr-status { display:flex; align-items:center; gap:5px; color:rgba(255,255,255,.32); font-size:8px; font-weight:600; letter-spacing:.4px; text-transform:uppercase; }
.hdr-status-dot { width:5px; height:5px; border-radius:50%; background:#34d399; box-shadow:0 0 7px rgba(52,211,153,.55); }
`;

export default function Header() {
  const { user, balance, telegramUser } = useApp();
  const level = user?.level || 1;
  const levelInfo = getLevelInfo(level);
  const displayName = user?.first_name || telegramUser?.first_name || "User";
  const points = balance?.points || 0;
  const LevelIcon = level >= 25 ? Crown : Sparkles;

  return (
    <>
      <style>{CSS}</style>
      <div className="hdr-root">
        <div className="hdr-shell">
          <div className="hdr-row">
            <div className="hdr-avatar-wrap">
              <div className="hdr-avatar" style={{ color: levelInfo.color }}>
                {user?.photo_url ? <img src={user.photo_url} alt={displayName} /> : displayName[0]?.toUpperCase()}
              </div>
              <div className="hdr-level-badge" style={{ background: levelInfo.color }}>{level}</div>
            </div>

            <div className="hdr-name-block">
              <div className="hdr-name">
                {displayName}{user?.username && <span className="hdr-username"> @{user.username}</span>}
              </div>
              <div className="hdr-level-label" style={{ color: levelInfo.color }}>
                <LevelIcon /> {levelInfo.name}
              </div>
            </div>

            <div className="hdr-points">
              <Gem />
              <span className="hdr-points-val">{points.toLocaleString()}</span>
            </div>
          </div>

          <div className="hdr-brand">
            <div className="hdr-brand-left">
              <Sparkles />
              <div className="hdr-title">ADS <b>REWARDS</b></div>
            </div>
            <div className="hdr-status"><span className="hdr-status-dot" /> Live</div>
          </div>
        </div>
      </div>
    </>
  );
}
