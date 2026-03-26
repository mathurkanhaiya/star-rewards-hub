import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, getUserTasks, completeTask } from '@/lib/api';
import { Task } from '@/types/telegram';
import PromoSection from '@/components/games/PromoSection';

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

const TASK_TYPES: Record<string, { color: string; glow: string; label: string }> = {
  social:   { color: '#22d3ee', glow: 'rgba(34,211,238,0.3)',   label: 'Social'   },
  daily:    { color: '#ffbe00', glow: 'rgba(255,190,0,0.3)',    label: 'Daily'    },
  referral: { color: '#4ade80', glow: 'rgba(74,222,128,0.3)',   label: 'Referral' },
  video:    { color: '#a855f7', glow: 'rgba(168,85,247,0.3)',   label: 'Video'    },
  special:  { color: '#ef4444', glow: 'rgba(239,68,68,0.3)',    label: 'Special'  },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

.tp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Header ── */
.tp-header {
  padding: 4px 0 20px;
}
.tp-eyebrow {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.tp-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  line-height: 1;
}
.tp-title span { color: #ffbe00; text-shadow: 0 0 16px rgba(255,190,0,0.4); }

/* ── Filter strip ── */
.tp-filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 18px;
  scrollbar-width: none;
}
.tp-filters::-webkit-scrollbar { display: none; }

.tp-filter-btn {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.tp-filter-btn.active {
  background: #ffbe00;
  border-color: #ffbe00;
  color: #1a0800;
  box-shadow: 0 0 16px rgba(255,190,0,0.35);
}
.tp-filter-btn[data-type="social"].active   { background: #22d3ee; border-color: #22d3ee; color: #001a20; box-shadow: 0 0 16px rgba(34,211,238,0.35); }
.tp-filter-btn[data-type="daily"].active    { background: #ffbe00; border-color: #ffbe00; color: #1a0800; box-shadow: 0 0 16px rgba(255,190,0,0.35); }
.tp-filter-btn[data-type="referral"].active { background: #4ade80; border-color: #4ade80; color: #001a0a; box-shadow: 0 0 16px rgba(74,222,128,0.35); }
.tp-filter-btn[data-type="video"].active    { background: #a855f7; border-color: #a855f7; color: #fff;    box-shadow: 0 0 16px rgba(168,85,247,0.35); }
.tp-filter-btn[data-type="special"].active  { background: #ef4444; border-color: #ef4444; color: #fff;    box-shadow: 0 0 16px rgba(239,68,68,0.35); }

/* ── States ── */
.tp-loading {
  text-align: center;
  padding: 40px 0;
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.15);
}
.tp-loading-dots span {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #ffbe00;
  margin: 0 3px;
  animation: tpDot 1.2s ease-in-out infinite;
}
.tp-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.tp-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes tpDot { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }

.tp-empty {
  text-align: center;
  padding: 48px 0;
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.15);
  text-transform: uppercase;
}

/* ── Task card ── */
.tp-card {
  background: rgba(255,255,255,0.02);
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.tp-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  border-radius: 20px;
}

.tp-card-top-beam {
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  pointer-events: none;
}

.tp-card-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 1;
}

/* Icon */
.tp-icon {
  width: 52px; height: 52px;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

/* Text */
.tp-card-body { flex: 1; min-width: 0; }
.tp-card-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  line-height: 1.2;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-card-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  line-height: 1.4;
  margin-bottom: 6px;
}
.tp-card-reward {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

/* Type badge */
.tp-type-tag {
  display: inline-block;
  font-family: 'Orbitron', monospace;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 20px;
  margin-bottom: 5px;
}

/* Start button */
.tp-start-btn {
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.12s, opacity 0.2s, box-shadow 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.tp-start-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: tpShine 3s ease-in-out infinite;
}
@keyframes tpShine { 0%{left:-100%} 40%,100%{left:150%} }
.tp-start-btn:active { transform: scale(0.94); }
.tp-start-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Message bar */
.tp-msg {
  margin-top: 12px;
  padding: 9px 14px;
  border-radius: 12px;
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  text-align: center;
  position: relative;
  z-index: 1;
  animation: tpMsgIn 0.2s ease;
}
@keyframes tpMsgIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-msg.success {
  background: rgba(74,222,128,0.08);
  border: 1px solid rgba(74,222,128,0.2);
  color: #4ade80;
}
.tp-msg.error {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  color: #f87171;
}

/* Count badge */
.tp-count {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.15);
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-left: 2px;
}
`;

export default function TasksPage() {
  const { user, refreshBalance } = useApp();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    const [allTasks, userTasksList] = await Promise.all([
      getTasks(),
      getUserTasks(user.id),
    ]);
    const completedIds = new Set(
      (userTasksList as Array<{ task_id: string }>).map(ut => ut.task_id)
    );
    setCompletedTaskIds(completedIds);
    let available = allTasks.filter(task => task.is_repeatable || !completedIds.has(task.id));
    available.sort((a, b) => b.reward_points - a.reward_points);
    setTasks(available);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function handleComplete(task: Task) {
    if (!user || completing) return;
    triggerHaptic();
    setCompleting(task.id);
    try {
      if (task.link) {
        if ((window as any).Telegram?.WebApp) {
          (window as any).Telegram.WebApp.openTelegramLink(task.link);
        } else {
          window.open(task.link, '_blank');
        }
      }
      const result = await completeTask(user.id, task.id);
      if (result.success) {
        triggerHaptic('success');
        setMessage({ id: task.id, text: `+${result.points} pts earned`, success: true });
        setTasks(prev => prev.filter(t => t.id !== task.id));
        setCompletedTaskIds(prev => new Set([...prev, task.id]));
        await refreshBalance();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      triggerHaptic('error');
      setMessage({ id: task.id, text: err.message || 'Task failed', success: false });
    }
    setCompleting(null);
    setTimeout(() => setMessage(null), 3000);
  }

  const filteredTasks = useMemo(() => {
    return filter === 'all' ? tasks : tasks.filter(t => t.task_type === filter);
  }, [tasks, filter]);

  const filters = ['all', 'social', 'daily', 'referral', 'video', 'special'];

  return (
    <>
      <style>{CSS}</style>
      <div className="tp-root">

        {/* ── Header ── */}
        <div className="tp-header">
          <div className="tp-eyebrow">Earn · Complete</div>
          <div className="tp-title">TASK <span>BOARD</span></div>
        </div>

        {/* ── Filters ── */}
        <div className="tp-filters">
          {filters.map(f => (
            <button
              key={f}
              data-type={f}
              className={`tp-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => { triggerHaptic(); setFilter(f); }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Promo ── */}
        <div style={{ marginBottom: 18 }}>
          <PromoSection />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="tp-loading">
            <div style={{ marginBottom: 10 }}>Loading Tasks</div>
            <div className="tp-loading-dots"><span /><span /><span /></div>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filteredTasks.length === 0 && (
          <div className="tp-empty">✦ All tasks completed ✦</div>
        )}

        {/* ── Task count ── */}
        {!loading && filteredTasks.length > 0 && (
          <div className="tp-count">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} available</div>
        )}

        {/* ── Task list ── */}
        <div>
          {filteredTasks.map(task => {
            const isCompleting = completing === task.id;
            const tc = TASK_TYPES[task.task_type] || { color: '#ffbe00', glow: 'rgba(255,190,0,0.3)', label: 'Task' };

            return (
              <div
                key={task.id}
                className="tp-card"
                style={{
                  border: `1px solid ${tc.color}25`,
                  boxShadow: `0 0 20px ${tc.glow}15`,
                }}
              >
                {/* Top beam */}
                <div
                  className="tp-card-top-beam"
                  style={{ background: `linear-gradient(90deg, transparent, ${tc.color}35, transparent)` }}
                />

                <div className="tp-card-inner">
                  {/* Icon */}
                  <div
                    className="tp-icon"
                    style={{
                      background: `${tc.color}10`,
                      border: `1px solid ${tc.color}30`,
                      boxShadow: `0 0 12px ${tc.glow}`,
                    }}
                  >
                    {task.icon || '✨'}
                  </div>

                  {/* Body */}
                  <div className="tp-card-body">
                    <div
                      className="tp-type-tag"
                      style={{ background: `${tc.color}12`, border: `1px solid ${tc.color}25`, color: tc.color }}
                    >
                      {tc.label}
                    </div>
                    <div className="tp-card-title">{task.title}</div>
                    {task.description && (
                      <div className="tp-card-desc">{task.description}</div>
                    )}
                    <div className="tp-card-reward" style={{ color: tc.color }}>
                      ✦ +{task.reward_points} PTS
                    </div>
                  </div>

                  {/* Button */}
                  <button
                    className="tp-start-btn"
                    disabled={isCompleting}
                    onClick={() => handleComplete(task)}
                    style={{
                      background: `linear-gradient(135deg, ${tc.color}, ${tc.color}cc)`,
                      color: ['video', 'special'].includes(task.task_type) ? '#fff' : '#001a0a',
                      boxShadow: `0 4px 16px ${tc.glow}`,
                    }}
                  >
                    {isCompleting ? '···' : 'START'}
                  </button>
                </div>

                {/* Message */}
                {message?.id === task.id && (
                  <div className={`tp-msg ${message.success ? 'success' : 'error'}`}>
                    {message.success ? '✦' : '✕'} {message.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}
