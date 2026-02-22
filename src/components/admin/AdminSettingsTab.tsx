import React, { useState } from 'react';

interface Props {
  settings: Record<string, string>;
  editSettings: Record<string, string>;
  setEditSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (key: string) => void;
  saving: string | null;
}

const SETTING_GROUPS = {
  'Conversion Rates': ['stars_conversion_rate', 'usdt_conversion_rate', 'ton_conversion_rate'],
  'Spin Settings': ['max_daily_spins', 'spin_cooldown_hours', 'spin_reward_min', 'spin_reward_max', 'spin_jackpot', 'spin_jackpot_chance'],
  'Rewards': ['points_per_referral', 'referral_bonus_referred', 'daily_bonus_base', 'ad_reward_points'],
  'Limits': ['min_withdrawal_points', 'max_pending_withdrawals'],
  'System': ['maintenance_mode', 'bot_name'],
};

const SETTING_LABELS: Record<string, string> = {
  stars_conversion_rate: '⭐ Stars rate (pts per 1 Star)',
  usdt_conversion_rate: '💵 USDT rate (pts per 1 USDT)',
  ton_conversion_rate: '💎 TON rate (pts per 1 TON)',
  max_daily_spins: '🎡 Max spins per cooldown',
  spin_cooldown_hours: '⏰ Spin cooldown (hours)',
  spin_reward_min: '📊 Min spin reward (pts)',
  spin_reward_max: '📊 Max spin reward (pts)',
  spin_jackpot: '🎰 Jackpot reward (pts)',
  spin_jackpot_chance: '🎲 Jackpot chance (%)',
  points_per_referral: '👥 Referral reward (referrer)',
  referral_bonus_referred: '🎁 Referral bonus (invited)',
  daily_bonus_base: '📅 Daily reward base',
  ad_reward_points: '🎬 Ad watch reward',
  min_withdrawal_points: '💸 Min withdrawal (pts)',
  max_pending_withdrawals: '📋 Max pending withdrawals',
  maintenance_mode: '🔧 Maintenance mode',
  bot_name: '🤖 Bot name',
};

export default function AdminSettingsTab({ settings, editSettings, setEditSettings, onSave, saving }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Conversion Rates');

  // Also show any settings not in groups
  const groupedKeys = Object.values(SETTING_GROUPS).flat();
  const ungrouped = Object.keys(editSettings).filter(k => !groupedKeys.includes(k));

  function renderSetting(key: string) {
    const label = SETTING_LABELS[key] || key.replace(/_/g, ' ');
    const changed = settings[key] !== editSettings[key];
    return (
      <div key={key} className="p-3 rounded-xl" style={{ background: 'hsl(220 25% 6%)', border: `1px solid ${changed ? 'hsl(45 100% 55% / 0.4)' : 'hsl(220 20% 15%)'}` }}>
        <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={editSettings[key] || ''}
            onChange={e => setEditSettings(prev => ({ ...prev, [key]: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none font-mono"
            style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }}
          />
          <button
            onClick={() => onSave(key)}
            disabled={saving === key}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            style={{ background: changed ? 'hsl(45 100% 55%)' : 'hsl(45 100% 55% / 0.2)', color: changed ? 'hsl(220 30% 5%)' : 'hsl(45 100% 60%)', opacity: saving === key ? 0.5 : 1 }}
          >
            {saving === key ? '...' : changed ? '💾 Save' : 'Save'}
          </button>
        </div>
        {changed && (
          <div className="text-xs mt-1" style={{ color: 'hsl(45 100% 60%)' }}>
            ⚠ Unsaved — DB: "{settings[key]}"
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-2 rounded-xl text-xs text-center" style={{ background: 'hsl(45 100% 55% / 0.08)', border: '1px solid hsl(45 100% 55% / 0.2)', color: 'hsl(45 100% 60%)' }}>
        ⚡ Changes save directly to database. They persist across all sessions.
      </div>

      {Object.entries(SETTING_GROUPS).map(([group, keys]) => {
        const hasKeys = keys.some(k => k in editSettings);
        if (!hasKeys) return null;
        const isExpanded = expandedGroup === group;
        return (
          <div key={group}>
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group)}
              className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold"
              style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 15%)' }}
            >
              <span className="text-foreground">{group}</span>
              <span className="text-muted-foreground">{isExpanded ? '▼' : '▶'}</span>
            </button>
            {isExpanded && (
              <div className="mt-2 space-y-2 pl-1">
                {keys.filter(k => k in editSettings).map(k => renderSetting(k))}
              </div>
            )}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4">Other Settings</div>
          <div className="space-y-2">
            {ungrouped.map(k => renderSetting(k))}
          </div>
        </>
      )}
    </div>
  );
}
