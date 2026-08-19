import React from 'react';
import { useApp } from '@/context/AppContext';
import { usePreferences } from '@/context/PreferencesContext';

type Page='home'|'tasks'|'spin'|'referral'|'leaderboard'|'wallet'|'notifications'|'admin'|'games'|'tower'|'dice'|'cardflip'|'numberguess'|'luckybox';
interface GamesMenuProps{onNavigate:(page:Page)=>void}
const games=[
{id:'tower' as Page,icon:'🗼',nameKey:'towerClimb',descKey:'towerDesc',accent:'#f59e0b',tag:'ENDLESS'},
{id:'luckybox' as Page,icon:'🎁',nameKey:'luckyBox',descKey:'luckyDesc',accent:'#a855f7',tag:'LUCKY'},
{id:'dice' as Page,icon:'🎲',nameKey:'diceRoll',descKey:'diceDesc',accent:'#ef4444',tag:'CHANCE'},
{id:'cardflip' as Page,icon:'🃏',nameKey:'cardFlip',descKey:'cardDesc',accent:'#22d3ee',tag:'FLIP'},
{id:'numberguess' as Page,icon:'🔢',nameKey:'numberGuess',descKey:'numberDesc',accent:'#4ade80',tag:'GUESS'},
];
function hexToRgb(hex:string){return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;}
export default function GamesMenu({onNavigate}:GamesMenuProps){
 const {balance}=useApp();const {t,theme}=usePreferences();const light=theme==='light';
 return <div style={{minHeight:'100vh',padding:'20px 16px 112px',background:light?'transparent':'#080b14',color:light?'#0f172a':'#fff'}}>
 <style>{`.game-head{text-align:center;margin-bottom:20px}.game-title{font-size:27px;font-weight:900;letter-spacing:2px;margin:0;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.game-sub{font-size:11px;letter-spacing:2px;opacity:.45;text-transform:uppercase;margin-top:5px}.game-bal{width:max-content;margin:0 auto 22px;padding:9px 16px;border-radius:999px;background:#fbbf2412;border:1px solid #fbbf2440;font-weight:800}.game-card{width:100%;border-radius:18px;padding:14px;margin-bottom:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);color:inherit;text-align:left}.game-row{display:flex;align-items:center;gap:13px}.game-icon{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:34px}.game-body{flex:1;min-width:0}.game-name{font-size:15px;font-weight:800}.game-desc{font-size:12px;opacity:.42;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.game-tag{font-size:8px;font-weight:800;letter-spacing:1.4px;padding:3px 7px;border-radius:7px;margin-left:7px}.game-arrow{font-size:24px;opacity:.45}.game-card:active{transform:scale(.98)}[data-theme='light'] .game-card{background:rgba(255,255,255,.76);border-color:rgba(15,23,42,.08);box-shadow:0 10px 28px rgba(45,60,90,.07)}`}</style>
 <div className="game-head"><h1 className="game-title">{t('gameZone').toUpperCase()}</h1><div className="game-sub">{t('playEarnRepeat')}</div></div>
 <div className="game-bal">🪙 {balance?balance.points.toLocaleString():'•••'} {t('points').toUpperCase()}</div>
 {games.map(game=>{const rgb=hexToRgb(game.accent);return <button key={game.id} className="game-card" onClick={()=>onNavigate(game.id)} style={{borderColor:`rgba(${rgb},.22)`}}><div className="game-row"><div className="game-icon" style={{background:`rgba(${rgb},.12)`,border:`1px solid rgba(${rgb},.22)`}}>{game.icon}</div><div className="game-body"><div><span className="game-name">{t(game.nameKey)}</span><span className="game-tag" style={{color:game.accent,background:`rgba(${rgb},.12)`}}>{game.tag}</span></div><div className="game-desc">{t(game.descKey)}</div></div><div className="game-arrow">›</div></div></button>})}
 </div>;
}
export type{Page};
