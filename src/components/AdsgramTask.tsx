import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clapperboard, Clock3, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { claimAdsgramTaskReward } from '@/lib/api';

interface AdsgramTaskProps {
  blockId: string;
  rewardAmount?: number;
  onReward?: (detail: unknown) => void;
  onError?: (detail: unknown) => void;
}

type TaskState = 'idle' | 'crediting' | 'done' | 'error' | 'no_banner' | 'session';
const REFRESH_SECONDS = 15;

const CSS = `
.ags-wrap{position:relative;overflow:hidden;border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.095),rgba(255,255,255,.025)),rgba(8,13,24,.5);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.14),0 14px 34px rgba(0,0,0,.18);backdrop-filter:blur(24px) saturate(145%);animation:ags-rise .46s cubic-bezier(.2,.8,.2,1) both}
.ags-wrap::before{content:'';position:absolute;top:-80px;right:-50px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(255,190,0,.2),transparent 68%);animation:ags-glow 3.2s ease-in-out infinite;pointer-events:none}.ags-wrap::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.08) 49%,transparent 63%);transform:translateX(-125%);animation:ags-shine 5s 1s ease-in-out infinite;pointer-events:none}.ags-inner{position:relative;z-index:1}.ags-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px 4px}.ags-left{display:flex;align-items:center;gap:11px;min-width:0}.ags-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:0 0 44px;color:#ffd84d;background:rgba(255,190,0,.09);border:1px solid rgba(255,190,0,.24);box-shadow:0 0 20px rgba(255,190,0,.1);animation:ags-float 2.8s ease-in-out infinite}.ags-icon svg{width:21px}.ags-title{font:800 10px 'Orbitron',sans-serif;letter-spacing:1.35px}.ags-sub{font-size:10px;opacity:.42;margin-top:3px}.ags-badge{font:800 10px 'Orbitron',sans-serif;color:#ffd84d;background:rgba(255,190,0,.08);border:1px solid rgba(255,190,0,.22);padding:6px 10px;border-radius:14px;white-space:nowrap}.ags-task{--adsgram-task-font-size:14px;--adsgram-task-icon-size:44px;--adsgram-task-icon-title-gap:11px;--adsgram-task-icon-border-radius:13px;--adsgram-task-button-width:68px;display:block;margin:7px 10px 5px;padding:9px 10px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.065);min-height:64px}.ags-slot-reward{font:750 9px 'Orbitron',sans-serif;color:#ffd84d}.ags-slot-btn{min-width:62px;padding:8px 9px;border-radius:10px;text-align:center;font:800 8px 'Orbitron',sans-serif;letter-spacing:.7px;color:#171006;background:linear-gradient(135deg,#ffe276,#f7b714);box-shadow:inset 0 1px rgba(255,255,255,.45)}.ags-slot-btn.claim{background:linear-gradient(135deg,#67e8f9,#22d3ee)}.ags-slot-btn.done{color:#052e1a;background:linear-gradient(135deg,#86efac,#4ade80)}.ags-footer{display:flex;align-items:center;gap:7px;padding:7px 14px 12px;font-size:9px;opacity:.52}.ags-footer svg{width:13px;flex:0 0 13px}.ags-footer span:first-of-type{flex:1}.ags-count{font:750 9px 'Orbitron',sans-serif;color:#67e8f9;opacity:1}.ags-progress{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.04)}.ags-progress span{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#ffd84d);transition:width .25s linear}.ags-status{display:flex;align-items:center;gap:7px;margin:7px 12px 2px;padding:9px 10px;border-radius:12px;font-size:10px;animation:ags-pop .22s ease-out}.ags-status svg{width:14px}.ags-status.error,.ags-status.session{color:#fca5a5;background:rgba(239,68,68,.075);border:1px solid rgba(239,68,68,.16)}.ags-status.no-banner{color:#cbd5e1;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.13)}.ags-overlay{position:absolute;inset:0;z-index:5;display:grid;place-items:center;text-align:center;background:rgba(5,8,15,.88);backdrop-filter:blur(7px);animation:ags-fade .22s ease-out}.ags-overlay-content{display:grid;justify-items:center;gap:6px}.ags-overlay-icon{width:38px;height:38px;padding:9px;border-radius:14px;color:#4ade80;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.2);animation:ags-pop .42s cubic-bezier(.34,1.56,.64,1)}.ags-overlay-icon.spin{color:#ffd84d;background:rgba(255,190,0,.1);border-color:rgba(255,190,0,.2);animation:ags-spin 1s linear infinite}.ags-overlay-title{font:850 14px 'Orbitron',sans-serif;color:#86efac;letter-spacing:1px}.ags-overlay-sub{font-size:10px;color:rgba(255,255,255,.48)}
@keyframes ags-rise{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:none}}@keyframes ags-glow{50%{transform:scale(1.12);opacity:.65}}@keyframes ags-shine{0%,60%{transform:translateX(-125%)}85%,100%{transform:translateX(125%)}}@keyframes ags-float{50%{transform:translateY(-3px) rotate(4deg)}}@keyframes ags-pop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}@keyframes ags-fade{from{opacity:0}to{opacity:1}}@keyframes ags-spin{to{transform:rotate(360deg)}}
[data-theme='light'] .ags-wrap{background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(245,248,255,.84));border-color:rgba(15,23,42,.09);box-shadow:0 12px 30px rgba(45,58,85,.08);color:#0f172a}[data-theme='light'] .ags-task{background:rgba(15,23,42,.025);border-color:rgba(15,23,42,.07)}[data-theme='light'] .ags-overlay{background:rgba(248,250,252,.93)}[data-theme='light'] .ags-overlay-sub{color:#64748b}
@media(prefers-reduced-motion:reduce){.ags-wrap,.ags-wrap::before,.ags-wrap::after,.ags-icon,.ags-status,.ags-overlay,.ags-overlay-icon{animation-duration:.01ms!important;animation-iteration-count:1!important}.ags-progress span{transition:none}}
`;

export default function AdsgramTask({ blockId, rewardAmount = 10, onReward, onError }: AdsgramTaskProps) {
  const { refreshBalance, settings } = useApp();
  const taskRef = useRef<HTMLElement | null>(null);
  const claimingRef = useRef(false);
  const refreshAtRef = useRef(Date.now() + REFRESH_SECONDS * 1000);
  const onRewardRef = useRef(onReward);
  const onErrorRef = useRef(onError);
  const [state, setState] = useState<TaskState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshIn, setRefreshIn] = useState(REFRESH_SECONDS);
  const configuredRewardValue = settings.adsgram_task_reward_points?.trim();
  const configuredReward = Number(configuredRewardValue);
  const displayedReward = configuredRewardValue && Number.isFinite(configuredReward) && configuredReward >= 0 ? configuredReward : rewardAmount;

  useEffect(() => {
    onRewardRef.current = onReward;
    onErrorRef.current = onError;
  }, [onReward, onError]);

  const scheduleRefresh = useCallback((seconds = REFRESH_SECONDS) => {
    refreshAtRef.current = Date.now() + seconds * 1000;
    setRefreshIn(seconds);
  }, []);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((refreshAtRef.current - Date.now()) / 1000));
      setRefreshIn(remaining);
      if (remaining > 0 || claimingRef.current) return;
      refreshAtRef.current = Date.now() + REFRESH_SECONDS * 1000;
      setRefreshIn(REFRESH_SECONDS);
      setStatusMessage('');
      setState('idle');
      setReloadKey(key => key + 1);
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;
    let active = true;

    const handleReward = async (event: Event) => {
      if (claimingRef.current) return;
      claimingRef.current = true;
      setState('crediting');
      const detail = (event as CustomEvent<unknown>).detail;
      const result = await claimAdsgramTaskReward(blockId);

      if (active) {
        if (result.success) {
          setState('done');
          setStatusMessage('');
          onRewardRef.current?.(detail);
          await refreshBalance();
          window.dispatchEvent(new Event('balance-refresh'));
        } else {
          setState('error');
          setStatusMessage(result.message || 'Reward verification failed');
          onErrorRef.current?.(result);
        }
        scheduleRefresh(Math.max(1, result.retryAfter || REFRESH_SECONDS));
      }
      claimingRef.current = false;
    };

    const handleError = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<unknown>).detail;
      setState('error');
      setStatusMessage('Task temporarily unavailable');
      onErrorRef.current?.(detail);
      scheduleRefresh();
    };

    const handleNoBanner = () => {
      if (!active) return;
      setState('no_banner');
      setStatusMessage('Searching for a new task');
      scheduleRefresh();
    };

    const handleLongSession = () => {
      if (!active) return;
      setState('session');
      setStatusMessage('Reopen the app to refresh Adsgram');
    };

    task.addEventListener('reward', handleReward);
    task.addEventListener('onError', handleError);
    task.addEventListener('error', handleError);
    task.addEventListener('onBannerNotFound', handleNoBanner);
    task.addEventListener('bannerNotFound', handleNoBanner);
    task.addEventListener('onTooLongSession', handleLongSession);

    return () => {
      active = false;
      task.removeEventListener('reward', handleReward);
      task.removeEventListener('onError', handleError);
      task.removeEventListener('error', handleError);
      task.removeEventListener('onBannerNotFound', handleNoBanner);
      task.removeEventListener('bannerNotFound', handleNoBanner);
      task.removeEventListener('onTooLongSession', handleLongSession);
    };
  }, [blockId, reloadKey, refreshBalance, scheduleRefresh]);

  const progress = Math.min(100, Math.max(0, ((REFRESH_SECONDS - refreshIn) / REFRESH_SECONDS) * 100));

  return <><style>{CSS}</style><section className="ags-wrap" aria-label="Adsgram sponsored task">
    <div className="ags-inner">
      <div className="ags-header"><div className="ags-left"><div className="ags-icon"><Clapperboard/></div><div><div className="ags-title">ADSGRAM TASK</div><div className="ags-sub">Complete · claim · repeat</div></div></div><div className="ags-badge">+{displayedReward} ADR</div></div>
      {(state === 'error' || state === 'session') && <div className={`ags-status ${state}`}><WifiOff/>{statusMessage}</div>}
      {state === 'no_banner' && <div className="ags-status no-banner"><RefreshCw/>{statusMessage}</div>}
      <adsgram-task key={reloadKey} ref={taskRef} className="ags-task" data-block-id={blockId} data-debug="false" data-debug-console="false">
        <span slot="reward" className="ags-slot-reward">+{displayedReward} ADR</span>
        <div slot="button" className="ags-slot-btn">OPEN</div>
        <div slot="claim" className="ags-slot-btn claim">CLAIM</div>
        <div slot="done" className="ags-slot-btn done">DONE</div>
      </adsgram-task>
      <div className="ags-footer"><Clock3/><span>New task refresh</span><span className="ags-count">{refreshIn}s</span></div>
    </div>
    <div className="ags-progress"><span style={{ width: `${progress}%` }}/></div>
    {state === 'crediting' && <div className="ags-overlay"><div className="ags-overlay-content"><LoaderCircle className="ags-overlay-icon spin"/><div className="ags-overlay-title">VERIFYING</div><div className="ags-overlay-sub">Confirming reward on the server</div></div></div>}
    {state === 'done' && <div className="ags-overlay"><div className="ags-overlay-content"><CheckCircle2 className="ags-overlay-icon"/><div className="ags-overlay-title">+{displayedReward} ADR</div><div className="ags-overlay-sub">New task loads in {refreshIn}s</div></div></div>}
  </section></>;
}
