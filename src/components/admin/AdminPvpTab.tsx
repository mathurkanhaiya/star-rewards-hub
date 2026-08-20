import React, { useEffect, useMemo, useState } from 'react';
import type { AdminPvpOverview } from '@/lib/pvpApi';

type Props = {
  overview: AdminPvpOverview | null;
  onSave: (key: string, value: string) => Promise<void>;
  refreshing?: boolean;
};

type Field = { key: string; label: string; suffix?: string; min?: number; step?: string };

const fields: Field[] = [
  { key: 'pvp_credits_per_adr', label: 'Game Credits per 1 ADR', min: 0.01, step: '0.01' },
  { key: 'pvp_min_entry', label: 'Minimum Entry', suffix: 'Credits', min: 1 },
  { key: 'pvp_max_entry', label: 'Maximum Entry', suffix: 'Credits', min: 1 },
  { key: 'pvp_fee_percent', label: 'Game Fee', suffix: '%', min: 0, step: '0.1' },
  { key: 'pvp_match_timeout_seconds', label: 'Challenge Timeout', suffix: 'sec', min: 30 },
  { key: 'pvp_play_timeout_seconds', label: 'Game Fail-Safe Timeout', suffix: 'sec', min: 60 },
  { key: 'pvp_user_cooldown_seconds', label: 'Default User Cooldown', suffix: 'sec', min: 0 },
  { key: 'pvp_max_active_per_user', label: 'Max Active Games / User', min: 1 },
  { key: 'pvp_max_daily_matches', label: 'Max Daily Matches / User', min: 1 },
];

const fmt = (value: unknown) => Number(value || 0).toLocaleString();
const niceGame = (key: string) => key === '—' ? '—' : key.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());

export default function AdminPvpTab({ overview, onSave, refreshing }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string>('');

  useEffect(() => {
    setDraft(overview?.settings || {});
  }, [overview]);

  const cards = useMemo(() => [
    ['Matches Today', overview?.matchesToday || 0, '⚔️'],
    ['Active Players', overview?.activePlayers || 0, '👥'],
    ['Credits Converted', overview?.creditsConverted || 0, '💱'],
    ['Credits Used', overview?.creditsUsed || 0, '🎮'],
    ['Credits Locked', overview?.creditsLocked || 0, '🔒'],
    ['Most Played', overview?.mostPlayedCount || 0, '🏆'],
  ], [overview]);

  async function save(key: string, value = draft[key] ?? '') {
    setSaving(key);
    try { await onSave(key, String(value)); }
    finally { setSaving(''); }
  }

  if (!overview) return <div className="pvp-empty">Unable to load live PvP data.</div>;

  const enabled = String(draft.pvp_enabled ?? 'true').toLowerCase() !== 'false';
  const tie = String(draft.pvp_tie_behavior || 'replay').toLowerCase() === 'refund' ? 'refund' : 'replay';

  return <div className="pvp-admin">
    <style>{`
      .pvp-admin{display:grid;gap:12px}.pvp-empty{padding:20px;border-radius:16px;background:#ffffff08;border:1px solid #ffffff12;color:#ffffff77}
      .pvp-summary{padding:15px;border-radius:18px;background:linear-gradient(135deg,#8b5cf61d,#22d3ee12);border:1px solid #a78bfa35}.pvp-summary-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.pvp-summary h3{margin:0;font-size:17px}.pvp-summary p{margin:5px 0 0;font-size:11px;color:#ffffff75;line-height:1.45}.pvp-switch{border:1px solid #ffffff18;border-radius:999px;padding:8px 11px;color:#fff;font-weight:800;background:#ffffff0a}.pvp-switch.on{background:#22c55e20;border-color:#22c55e55;color:#86efac}.pvp-switch.off{background:#ef444420;border-color:#ef444455;color:#fca5a5}
      .pvp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pvp-card{padding:13px;border-radius:16px;background:#ffffff08;border:1px solid #ffffff10}.pvp-card-icon{font-size:18px}.pvp-card-value{font-size:20px;font-weight:900;margin-top:5px}.pvp-card-label{font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:#ffffff65;margin-top:3px}.pvp-most{font-size:11px;color:#c4b5fd;margin-top:8px}
      .pvp-section{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#ffffff58;margin:6px 2px 0}.pvp-fields{display:grid;gap:8px}.pvp-field{display:grid;grid-template-columns:1fr minmax(110px,140px);align-items:center;gap:10px;padding:11px 12px;border-radius:15px;background:#ffffff07;border:1px solid #ffffff0f}.pvp-field-label{font-size:12px;font-weight:750}.pvp-input-wrap{display:flex;align-items:center;gap:5px}.pvp-input{min-width:0;width:100%;box-sizing:border-box;border:1px solid #ffffff18;border-radius:11px;background:#050810;color:#fff;padding:9px}.pvp-suffix{font-size:9px;color:#ffffff55}.pvp-save{border:0;border-radius:10px;background:#8b5cf6;color:#fff;padding:9px 10px;font-weight:800;font-size:10px}.pvp-field-actions{display:flex;gap:5px}.pvp-field-actions .pvp-input{flex:1}.pvp-games{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pvp-game{display:flex;align-items:center;gap:8px;text-align:left;padding:11px;border-radius:14px;border:1px solid #ffffff12;background:#ffffff07;color:#fff}.pvp-game.off{opacity:.5}.pvp-game-emoji{font-size:19px}.pvp-game-name{font-size:11px;font-weight:800;flex:1}.pvp-game-state{font-size:9px;color:#86efac}.pvp-game.off .pvp-game-state{color:#fca5a5}.pvp-warning{padding:12px;border-radius:14px;background:#f59e0b12;border:1px solid #f59e0b35;color:#fde68a;font-size:10px;line-height:1.5}
    `}</style>

    <div className="pvp-summary">
      <div className="pvp-summary-top">
        <div><h3>🎮 Group PvP</h3><p>Telegram groups only · Game Credits are separate from withdrawable ADR.</p></div>
        <button className={`pvp-switch ${enabled ? 'on' : 'off'}`} disabled={!!saving || refreshing} onClick={() => save('pvp_enabled', String(!enabled))}>{saving === 'pvp_enabled' ? '…' : enabled ? 'ON' : 'OFF'}</button>
      </div>
      <div className="pvp-most">🏆 Most played: <b>{niceGame(overview.mostPlayedGame)}</b>{overview.mostPlayedCount ? ` · ${fmt(overview.mostPlayedCount)} matches` : ''}</div>
    </div>

    <div className="pvp-grid">{cards.map(([label, value, icon]) => <div className="pvp-card" key={String(label)}><div className="pvp-card-icon">{icon}</div><div className="pvp-card-value">{fmt(value)}</div><div className="pvp-card-label">{label}</div></div>)}</div>

    <div className="pvp-section">Economy & limits</div>
    <div className="pvp-fields">
      {fields.map(field => <div className="pvp-field" key={field.key}>
        <div className="pvp-field-label">{field.label}</div>
        <div className="pvp-field-actions">
          <div className="pvp-input-wrap"><input className="pvp-input" type="number" min={field.min} step={field.step || '1'} value={draft[field.key] ?? ''} onChange={e => setDraft(v => ({ ...v, [field.key]: e.target.value }))}/>{field.suffix && <span className="pvp-suffix">{field.suffix}</span>}</div>
          <button className="pvp-save" disabled={!!saving} onClick={() => save(field.key)}>{saving === field.key ? '…' : 'Save'}</button>
        </div>
      </div>)}

      <div className="pvp-field">
        <div className="pvp-field-label">Tie Behavior</div>
        <div className="pvp-field-actions">
          <select className="pvp-input" value={tie} onChange={e => setDraft(v => ({ ...v, pvp_tie_behavior: e.target.value }))}><option value="replay">Automatic Replay</option><option value="refund">Refund Both</option></select>
          <button className="pvp-save" disabled={!!saving} onClick={() => save('pvp_tie_behavior')}>{saving === 'pvp_tie_behavior' ? '…' : 'Save'}</button>
        </div>
      </div>
    </div>

    <div className="pvp-section">Enabled games</div>
    <div className="pvp-games">{overview.games.map(game => {
      const key = `pvp_game_${game.gameKey}_enabled`;
      const on = String(draft[key] ?? 'true').toLowerCase() !== 'false' && game.enabled;
      return <button key={game.gameKey} disabled={!!saving} className={`pvp-game ${on ? '' : 'off'}`} onClick={() => save(key, String(!on))}>
        <span className="pvp-game-emoji">{game.emoji}</span><span className="pvp-game-name">{game.name}</span><span className="pvp-game-state">{saving === key ? '…' : on ? 'ON' : 'OFF'}</span>
      </button>;
    })}</div>

    <div className="pvp-warning">⚠️ Game Credits can only be created through ADR → Game Credits conversion. They cannot be converted back to ADR, USDT, INR, or any withdrawal method.</div>
  </div>;
}
