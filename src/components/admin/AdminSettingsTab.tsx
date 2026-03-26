import React, { useState, useMemo } from 'react';

interface Props {
  settings: Record<string, string>;
  editSettings: Record<string, string>;
  setEditSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (key: string) => void;
  saving: string | null;
}

/* ── Group config ── */
const GROUPS: {
  label: string;
  icon: string;
  color: string;
  keys: string[];
}[] = [
  {
    label: 'Conversion Rates',
    icon: '💱',
    color: '#22d3ee',
    keys: ['stars_conversion_rate', 'usdt_conversion_rate', 'ton_conversion_rate'],
  },
  {
    label: 'Rewards',
    icon: '🎁',
    color: '#ffbe00',
    keys: ['ad_reward_points', 'daily_bonus_base', 'points_per_referral', 'referral_bonus_referred'],
  },
  {
    label: 'Spin Wheel',
    icon: '🎡',
    color: '#a78bfa',
    keys: ['max_daily_spins', 'spin_cooldown_hours', 'spin_reward_min', 'spin_reward_max', 'spin_jackpot', 'spin_jackpot_chance'],
  },
  {
    label: 'Games',
    icon: '🎮',
    color: '#f472b6',
    keys: ['tower_reward_multiplier', 'dice_reward_enabled', 'cardflip_reward_enabled', 'numberguess_reward_enabled', 'luckybox_reward_enabled'],
  },
  {
    label: 'Withdrawals',
    icon: '💸',
    color: '#4ade80',
    keys: ['min_withdrawal_points', 'max_pending_withdrawals', 'withdrawal_enabled', 'required_daily_ads'],
  },
  {
    label: 'Ads',
    icon: '🎬',
    color: '#fb923c',
    keys: ['ad_cooldown_seconds', 'ad_reward_points', 'max_ads_per_day', 'adsgram_block_id'],
  },
  {
    label: 'Daily & Referral',
    icon: '📅',
    color: '#34d399',
    keys: ['daily_bonus_base', 'daily_bonus_streak_multiplier', 'points_per_referral', 'referral_bonus_referred', 'max_referral_bonus'],
  },
  {
    label: 'Leaderboard',
    icon: '🏆',
    color: '#fbbf24',
    keys: ['leaderboard_refresh_seconds', 'leaderboard_max_entries'],
  },
  {
    label: 'System',
    icon: '⚙️',
    color: '#ef4444',
    keys: ['maintenance_mode', 'bot_name', 'app_version', 'support_username', 'channel_username'],
  },
];

const SETTING_META: Record<string, {
  label: string;
  description: string;
  type: 'text' | 'number' | 'toggle' | 'select';
  options?: string[];
  unit?: string;
  danger?: boolean;
}> = {
  stars_conversion_rate:        { label: 'Stars Rate',              description: 'Points awarded per 1 Telegram Star',        type: 'number', unit: 'pts/★'  },
  usdt_conversion_rate:         { label: 'USDT Rate',               description: 'Points required per 1 USDT withdrawal',     type: 'number', unit: 'pts/$'  },
  ton_conversion_rate:          { label: 'TON Rate',                description: 'Points required per 1 TON withdrawal',      type: 'number', unit: 'pts/◎'  },
  ad_reward_points:             { label: 'Ad Reward',               description: 'Points given per ad watch',                 type: 'number', unit: 'pts'    },
  daily_bonus_base:             { label: 'Daily Base Reward',       description: 'Base points for daily claim',               type: 'number', unit: 'pts'    },
  daily_bonus_streak_multiplier:{ label: 'Streak Multiplier',       description: 'Multiplier applied per consecutive day',    type: 'number', unit: 'x'      },
  points_per_referral:          { label: 'Referrer Reward',         description: 'Points given to the person who referred',   type: 'number', unit: 'pts'    },
  referral_bonus_referred:      { label: 'Referred Reward',         description: 'Points given to the new user joining',      type: 'number', unit: 'pts'    },
  max_referral_bonus:           { label: 'Max Referral Bonus',      description: 'Maximum total referral points per user',    type: 'number', unit: 'pts'    },
  max_daily_spins:              { label: 'Max Spins/Day',           description: 'Spin attempts allowed per cooldown period', type: 'number', unit: 'spins'  },
  spin_cooldown_hours:          { label: 'Spin Cooldown',           description: 'Hours between spin sessions',               type: 'number', unit: 'hrs'    },
  spin_reward_min:              { label: 'Min Spin Reward',         description: 'Minimum points from a spin',                type: 'number', unit: 'pts'    },
  spin_reward_max:              { label: 'Max Spin Reward',         description: 'Maximum points from a spin',                type: 'number', unit: 'pts'    },
  spin_jackpot:                 { label: 'Jackpot Reward',          description: 'Points awarded on jackpot',                 type: 'number', unit: 'pts'    },
  spin_jackpot_chance:          { label: 'Jackpot Chance',          description: 'Probability of jackpot hit',                type: 'number', unit: '%'      },
  tower_reward_multiplier:      { label: 'Tower Multiplier',        description: 'Points multiplier for Tower Climb',         type: 'number', unit: 'x'      },
  dice_reward_enabled:          { label: 'Dice Roll',               description: 'Enable/disable Dice Roll game rewards',     type: 'toggle' },
  cardflip_reward_enabled:      { label: 'Card Flip',               description: 'Enable/disable Card Flip game rewards',     type: 'toggle' },
  numberguess_reward_enabled:   { label: 'Number Guess',            description: 'Enable/disable Number Guess rewards',       type: 'toggle' },
  luckybox_reward_enabled:      { label: 'Lucky Box',               description: 'Enable/disable Lucky Box rewards',          type: 'toggle' },
  min_withdrawal_points:        { label: 'Min Withdrawal',          description: 'Minimum points needed to withdraw',         type: 'number', unit: 'pts'    },
  max_pending_withdrawals:      { label: 'Max Pending',             description: 'Max simultaneous pending withdrawals/user', type: 'number'                 },
  withdrawal_enabled:           { label: 'Withdrawals On/Off',      description: 'Master switch for all withdrawals',         type: 'toggle', danger: true   },
  required_daily_ads:           { label: 'Required Daily Ads',      description: 'Ads user must watch to unlock withdrawal',  type: 'number', unit: 'ads'    },
  ad_cooldown_seconds:          { label: 'Ad Cooldown',             description: 'Seconds between ad watches',                type: 'number', unit: 's'      },
  max_ads_per_day:              { label: 'Max Ads/Day',             description: 'Maximum ad watches per user per day',       type: 'number', unit: 'ads'    },
  adsgram_block_id:             { label: 'Adsgram Block ID',        description: 'Adsgram task block identifier',             type: 'text'                   },
  leaderboard_refresh_seconds:  { label: 'Leaderboard Refresh',     description: 'Auto-refresh interval for leaderboard',    type: 'number', unit: 's'      },
  leaderboard_max_entries:      { label: 'Max Entries',             description: 'How many users shown in leaderboard',      type: 'number', unit: 'users'  },
  maintenance_mode:             { label: 'Maintenance Mode',        description: 'Disables the app for all users',           type: 'toggle', danger: true   },
  bot_name:                     { label: 'Bot Name',                description: 'Display name for the bot',                 type: 'text'                   },
  app_version:                  { label: 'App Version',             description: 'Current app version string',               type: 'text'                   },
  support_username:             { label: 'Support Username',        description: 'Telegram username for support',            type: 'text'                   },
  channel_username:             { label: 'Channel Username',        description: 'Main Telegram channel username',           type: 'text'                   },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes asFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes asShine  { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes asPulse  { 0%,100%{opacity:0.7} 50%{opacity:1} }

.as-root { font-family: 'Rajdhani', sans-serif; color: #fff; }

/* Notice */
.as-notice {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 12px; margin-bottom: 16px;
  background: rgba(255,190,0,0.06); border: 1px solid rgba(255,190,0,0.2);
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,190,0,0.6); text-transform: uppercase;
}

/* Search */
.as-search-wrap { position: relative; margin-bottom: 14px; }
.as-search {
  width: 100%; padding: 11px 16px 11px 40px;
  border-radius: 13px; outline: none;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 14px;
  transition: border-color 0.2s; box-sizing: border-box;
}
.as-search:focus { border-color: rgba(239,68,68,0.4); }
.as-search::placeholder { color: rgba(255,255,255,0.2); }
.as-search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 15px; pointer-events: none; }

/* Group card */
.as-group {
  background: rgba(255,255,255,0.02);
  border-radius: 18px; margin-bottom: 8px; overflow: hidden;
  transition: border-color 0.2s;
}

.as-group-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 16px; cursor: pointer;
  position: relative; overflow: hidden;
}
.as-group-header::after {
  content: ''; position: absolute;
  inset: 0; background: rgba(255,255,255,0);
  transition: background 0.15s;
}
.as-group-header:hover::after { background: rgba(255,255,255,0.02); }

.as-group-icon {
  width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.as-group-label {
  flex: 1; font-family: 'Orbitron', monospace; font-size: 11px;
  font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.85);
}
.as-group-meta {
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 1px; color: rgba(255,255,255,0.2);
}
.as-group-arrow {
  font-size: 10px; color: rgba(255,255,255,0.2);
  transition: transform 0.25s; flex-shrink: 0;
}
.as-group-arrow.open { transform: rotate(180deg); }

/* Settings list inside group */
.as-settings-list { padding: 0 12px 12px; }

/* Setting row */
.as-setting-row {
  border-radius: 14px; padding: 12px 14px; margin-bottom: 6px;
  background: rgba(0,0,0,0.2); position: relative;
  transition: border-color 0.2s;
  animation: asFadeIn 0.2s ease both;
}
.as-setting-row.changed { }
.as-setting-row.danger  { }

.as-setting-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 8px; margin-bottom: 8px;
}
.as-setting-label {
  font-family: 'Orbitron', monospace; font-size: 10px;
  font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.8);
}
.as-setting-desc {
  font-size: 11px; color: rgba(255,255,255,0.2);
  letter-spacing: 0.5px; margin-top: 1px;
}
.as-unit-tag {
  font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 600;
  letter-spacing: 1.5px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
}
.as-danger-tag {
  font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 700;
  letter-spacing: 1.5px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444;
}

/* Input row */
.as-input-row { display: flex; gap: 8px; align-items: center; }
.as-input {
  flex: 1; padding: 10px 12px; border-radius: 11px;
  background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.07);
  color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 14px;
  outline: none; transition: border-color 0.2s; min-width: 0;
}
.as-input:focus { border-color: rgba(255,190,0,0.4); }
.as-input.changed { border-color: rgba(255,190,0,0.3); }

/* Toggle switch */
.as-toggle-wrap {
  display: flex; align-items: center; justify-content: space-between;
}
.as-toggle {
  width: 48px; height: 26px; border-radius: 13px; position: relative;
  cursor: pointer; transition: background 0.2s; flex-shrink: 0; border: none;
}
.as-toggle-thumb {
  position: absolute; top: 3px; width: 20px; height: 20px;
  border-radius: 50%; background: #fff;
  transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}

/* Save button */
.as-save-btn {
  padding: 10px 16px; border-radius: 11px; border: none;
  font-family: 'Orbitron', monospace; font-size: 9px;
  font-weight: 700; letter-spacing: 1px; cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s;
  flex-shrink: 0; position: relative; overflow: hidden;
  white-space: nowrap;
}
.as-save-btn::after {
  content: ''; position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: asShine 3s ease-in-out infinite;
}
.as-save-btn:active { transform: scale(0.95); }
.as-save-btn.changed {
  background: linear-gradient(135deg, #ffbe00, #f59e0b);
  color: #1a0800; box-shadow: 0 3px 12px rgba(255,190,0,0.3);
}
.as-save-btn.unchanged {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.25);
}
.as-save-btn.unchanged::after { display: none; }

/* Changed hint */
.as-changed-hint {
  margin-top: 6px; font-size: 10px; letter-spacing: 1px;
  color: rgba(255,190,0,0.5); display: flex; align-items: center; gap: 4px;
}
.as-changed-hint code {
  font-family: monospace; background: rgba(255,190,0,0.08);
  border: 1px solid rgba(255,190,0,0.2); border-radius: 4px;
  padding: 0 5px; color: rgba(255,190,0,0.7); font-size: 10px;
}

/* Save all banner */
.as-save-all-btn {
  width: 100%; padding: 14px; border-radius: 14px; border: none;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff; font-family: 'Orbitron', monospace; font-size: 12px;
  font-weight: 700; letter-spacing: 2px; cursor: pointer;
  transition: transform 0.12s; box-shadow: 0 4px 20px rgba(239,68,68,0.3);
  margin-bottom: 14px; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.as-save-all-btn::after {
  content: ''; position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  animation: asShine 3s ease-in-out infinite;
}
.as-save-all-btn:active { transform: scale(0.97); }

/* Empty search */
.as-empty {
  text-align: center; padding: 40px 0;
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 3px; color: rgba(255,255,255,0.1); text-transform: uppercase;
}

/* Changes count badge */
.as-changes-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 20px; margin-bottom: 12px;
  background: rgba(255,190,0,0.1); border: 1px solid rgba(255,190,0,0.25);
  font-family: 'Orbitron', monospace; font-size: 9px;
  font-weight: 700; color: #ffbe00; letter-spacing: 1px;
  animation: asPulse 2s ease-in-out infinite;
}
`;

export default function AdminSettingsTab({
  settings, editSettings, setEditSettings, onSave, saving,
}: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Rewards']));
  const [search, setSearch] = useState('');

  const groupedKeys = GROUPS.flatMap(g => g.keys);
  const ungroupedKeys = Object.keys(editSettings).filter(k => !groupedKeys.includes(k));

  const changedKeys = useMemo(() =>
    Object.keys(editSettings).filter(k => settings[k] !== editSettings[k]),
    [settings, editSettings]
  );

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function saveAll() {
    changedKeys.forEach(k => onSave(k));
  }

  /* Filter by search */
  const searchLower = search.trim().toLowerCase();
  function keyMatchesSearch(k: string) {
    if (!searchLower) return true;
    const meta = SETTING_META[k];
    return (
      k.toLowerCase().includes(searchLower) ||
      (meta?.label || '').toLowerCase().includes(searchLower) ||
      (meta?.description || '').toLowerCase().includes(searchLower)
    );
  }

  function isOn(val: string) {
    return val === 'true' || val === '1' || val === 'on';
  }

  function renderSettingRow(key: string, groupColor: string) {
    const meta = SETTING_META[key];
    if (!meta) return null;
    const val     = editSettings[key] ?? '';
    const origVal = settings[key] ?? '';
    const changed = val !== origVal;
    const isSaving = saving === key;

    return (
      <div
        key={key}
        className={`as-setting-row ${changed ? 'changed' : ''} ${meta.danger ? 'danger' : ''}`}
        style={{
          border: `1px solid ${changed ? 'rgba(255,190,0,0.3)' : meta.danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
        }}
      >
        {/* Header */}
        <div className="as-setting-header">
          <div>
            <div className="as-setting-label" style={{ color: changed ? '#ffbe00' : 'rgba(255,255,255,0.8)' }}>
              {meta.label}
            </div>
            <div className="as-setting-desc">{meta.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {meta.unit && <div className="as-unit-tag">{meta.unit}</div>}
            {meta.danger && <div className="as-danger-tag">DANGER</div>}
          </div>
        </div>

        {/* Toggle */}
        {meta.type === 'toggle' ? (
          <div className="as-toggle-wrap">
            <div style={{ fontSize: 13, color: isOn(val) ? groupColor : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {isOn(val) ? 'ENABLED' : 'DISABLED'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="as-toggle"
                style={{ background: isOn(val) ? groupColor : 'rgba(255,255,255,0.1)' }}
                onClick={() => {
                  const next = isOn(val) ? 'false' : 'true';
                  setEditSettings(prev => ({ ...prev, [key]: next }));
                }}
              >
                <div
                  className="as-toggle-thumb"
                  style={{ left: isOn(val) ? '25px' : '3px' }}
                />
              </button>
              <button
                className={`as-save-btn ${changed ? 'changed' : 'unchanged'}`}
                onClick={() => onSave(key)}
                disabled={isSaving || !changed}
              >
                {isSaving ? '···' : changed ? 'SAVE' : 'SAVED'}
              </button>
            </div>
          </div>
        ) : (
          /* Text / Number input */
          <div className="as-input-row">
            <input
              className={`as-input ${changed ? 'changed' : ''}`}
              type={meta.type === 'number' ? 'number' : 'text'}
              value={val}
              onChange={e => setEditSettings(prev => ({ ...prev, [key]: e.target.value }))}
            />
            <button
              className={`as-save-btn ${changed ? 'changed' : 'unchanged'}`}
              onClick={() => onSave(key)}
              disabled={isSaving || !changed}
            >
              {isSaving ? '···' : changed ? 'SAVE' : 'SAVED'}
            </button>
          </div>
        )}

        {/* Changed hint */}
        {changed && (
          <div className="as-changed-hint">
            ⚠ Current DB value: <code>{origVal || '(empty)'}</code>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="as-root">

        {/* Notice */}
        <div className="as-notice">
          ⚡ Changes save directly to database and persist across all sessions
        </div>

        {/* Unsaved changes badge + Save All */}
        {changedKeys.length > 0 && (
          <>
            <div className="as-changes-badge">
              ⚠ {changedKeys.length} unsaved change{changedKeys.length !== 1 ? 's' : ''}
            </div>
            <button className="as-save-all-btn" onClick={saveAll}>
              💾 SAVE ALL CHANGES ({changedKeys.length})
            </button>
          </>
        )}

        {/* Search */}
        <div className="as-search-wrap">
          <span className="as-search-icon">🔍</span>
          <input
            className="as-search"
            placeholder="Search settings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Groups */}
        {GROUPS.map(group => {
          const visibleKeys = group.keys.filter(k => k in editSettings && keyMatchesSearch(k));
          if (visibleKeys.length === 0) return null;
          const isOpen   = openGroups.has(group.label) || !!searchLower;
          const changed  = visibleKeys.filter(k => settings[k] !== editSettings[k]).length;

          return (
            <div
              key={group.label}
              className="as-group"
              style={{ border: `1px solid ${changed > 0 ? 'rgba(255,190,0,0.2)' : `${group.color}15`}` }}
            >
              <div className="as-group-header" onClick={() => toggleGroup(group.label)}>
                <div
                  className="as-group-icon"
                  style={{ background: `${group.color}12`, border: `1px solid ${group.color}25` }}
                >
                  {group.icon}
                </div>
                <div className="as-group-label" style={{ color: group.color }}>{group.label}</div>
                <div className="as-group-meta">
                  {visibleKeys.length} setting{visibleKeys.length !== 1 ? 's' : ''}
                  {changed > 0 && (
                    <span style={{ color: '#ffbe00', marginLeft: 6 }}>· {changed} changed</span>
                  )}
                </div>
                <div className={`as-group-arrow ${isOpen ? 'open' : ''}`}>▼</div>
              </div>

              {isOpen && (
                <div className="as-settings-list">
                  {visibleKeys.map(k => renderSettingRow(k, group.color))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped */}
        {ungroupedKeys.filter(keyMatchesSearch).length > 0 && (
          <div className="as-group" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="as-group-header" onClick={() => toggleGroup('__other')}>
              <div className="as-group-icon" style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}>
                🔧
              </div>
              <div className="as-group-label" style={{ color: '#94a3b8' }}>Other Settings</div>
              <div className="as-group-meta">{ungroupedKeys.filter(keyMatchesSearch).length} keys</div>
              <div className={`as-group-arrow ${openGroups.has('__other') ? 'open' : ''}`}>▼</div>
            </div>
            {openGroups.has('__other') && (
              <div className="as-settings-list">
                {ungroupedKeys.filter(keyMatchesSearch).map(k => {
                  const val = editSettings[k] ?? '';
                  const changed = val !== (settings[k] ?? '');
                  return (
                    <div key={k} className="as-setting-row" style={{ border: `1px solid ${changed ? 'rgba(255,190,0,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div className="as-setting-label" style={{ marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
                        {k.replace(/_/g, ' ')}
                      </div>
                      <div className="as-input-row">
                        <input
                          className={`as-input ${changed ? 'changed' : ''}`}
                          value={val}
                          onChange={e => setEditSettings(prev => ({ ...prev, [k]: e.target.value }))}
                        />
                        <button
                          className={`as-save-btn ${changed ? 'changed' : 'unchanged'}`}
                          onClick={() => onSave(k)}
                          disabled={!changed}
                        >
                          {saving === k ? '···' : changed ? 'SAVE' : 'SAVED'}
                        </button>
                      </div>
                      {changed && (
                        <div className="as-changed-hint">⚠ DB: <code>{settings[k] || '(empty)'}</code></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {searchLower && GROUPS.every(g => g.keys.filter(k => k in editSettings && keyMatchesSearch(k)).length === 0) && (
          <div className="as-empty">✦ No settings match "{search}" ✦</div>
        )}

      </div>
    </>
  );
}
