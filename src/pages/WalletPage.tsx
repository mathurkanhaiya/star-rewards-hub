import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  IndianRupee,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { usePreferences } from '@/context/PreferencesContext';
import { getTodayAdCount, getWithdrawals, submitWithdrawal } from '@/lib/api';

type Method = 'ton' | 'usdt_polygon' | 'upi';

const METHODS: Method[] = ['ton', 'usdt_polygon', 'upi'];
const LOGOS: Record<Method, string> = {
  ton: 'https://i.ibb.co/S4gdn1Ld/IMG-20260819-165638-236.png',
  usdt_polygon: 'https://i.ibb.co/DHBc4T8q/IMG-20260819-165010-103.png',
  upi: 'https://i.ibb.co/jZVCh3PF/IMG-20260819-165534-197.png',
};

const validTon = (value: string) => /^(UQ|EQ)[A-Za-z0-9_-]{46,}$/.test(value.trim());
const validPolygon = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());
const validUpi = (value: string) => {
  const upi = value.trim();
  if (upi.length < 5 || upi.length > 256) return false;
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9]+$/.test(upi)) return false;
  const [local, handle] = upi.split('@');
  return local.length >= 2 && handle.length >= 2 && handle.length <= 64;
};

const CSS = `
.ww-root{padding:0 16px 116px;color:inherit}.ww-head{padding:3px 1px 14px}.ww-kicker{font:700 9px 'Orbitron',sans-serif;letter-spacing:3px;opacity:.35;text-transform:uppercase}.ww-title{font:900 22px 'Orbitron',sans-serif;margin-top:4px}.ww-balance,.ww-req,.ww-method,.ww-amount,.ww-rate,.ww-info,.ww-hrow{background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.025)),rgba(10,15,27,.48);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(22px);box-shadow:inset 0 1px rgba(255,255,255,.13),0 12px 32px rgba(0,0,0,.18)}
.ww-balance{padding:18px;border-radius:25px;margin-bottom:10px}.ww-bal-label{font-size:10px;opacity:.4}.ww-bal{font:900 36px 'Orbitron',sans-serif;color:#ffe28a;margin:5px 0}.ww-bal small{font-size:12px;letter-spacing:1px;opacity:.68}.ww-bal-sub{font-size:11px;opacity:.4}
.ww-req{padding:14px;border-radius:19px;margin-bottom:12px}.ww-req-top{display:flex;justify-content:space-between;font-size:11px}.ww-req-top b{font:700 12px 'Orbitron',sans-serif;color:#67e8f9}.ww-track{height:6px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin:9px 0}.ww-fill{height:100%;background:linear-gradient(90deg,#22d3ee,#4ade80)}.ww-req-msg{font-size:10px;opacity:.5}.ww-req-msg.ok{color:#86efac;opacity:1}
.ww-sec{font:700 9px 'Orbitron',sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:.35;margin:16px 2px 8px}.ww-methods,.ww-history{display:grid;gap:8px}.ww-method{display:flex;align-items:center;gap:12px;padding:12px;border-radius:19px;color:inherit;text-align:left;position:relative}.ww-method.active{border-color:rgba(255,210,90,.34)}.ww-method.disabled{opacity:.48;filter:saturate(.35);cursor:not-allowed}.ww-disabled{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#f87171;margin-top:3px;font-weight:800}
.ww-logo{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.08);display:grid;place-items:center;overflow:hidden;position:relative;flex:0 0 46px}.ww-logo img{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);object-fit:cover;object-position:center;z-index:2;transform:scale(1.12)}.ww-logo img.asset-failed{display:none}.ww-logo svg{width:21px;z-index:1}.ww-mi{flex:1}.ww-mtitle{font-weight:800;font-size:13px}.ww-msub{font-size:10px;opacity:.42}.ww-method>svg{width:18px}
.ww-amounts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ww-amount{padding:12px;border-radius:16px;color:inherit;text-align:left}.ww-amount.active{border-color:rgba(74,222,128,.35)}.ww-apts{font-size:10px;opacity:.45}.ww-aval{font:750 15px 'Orbitron',sans-serif;margin-top:3px}.ww-rate{padding:10px 12px;border-radius:14px;margin-top:8px;font-size:10px;display:flex;justify-content:space-between}.ww-input{width:100%;padding:13px 14px;border-radius:15px;color:inherit;outline:none}.ww-submit{width:100%;margin-top:10px;padding:14px;border:0;border-radius:16px;background:linear-gradient(135deg,#ffd84d,#f5a400);color:#171006;font:800 11px 'Orbitron',sans-serif}.ww-submit:disabled{opacity:.38}.ww-message{margin-top:9px;padding:10px;border-radius:13px;font-size:11px;text-align:center}.ww-message.err{color:#fca5a5;background:rgba(239,68,68,.08)}.ww-message.ok{color:#86efac;background:rgba(74,222,128,.08)}
.ww-info{margin-top:12px;padding:12px;border-radius:16px;display:flex;gap:8px;font-size:10px;line-height:1.45}.ww-info svg{width:17px;flex:0 0 auto}.ww-hrow{display:flex;align-items:center;gap:10px;padding:11px;border-radius:15px}.ww-hicon{width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,.06);display:grid;place-items:center}.ww-hicon svg{width:16px}.ww-hbody{flex:1;min-width:0}.ww-htitle{font-size:12px;font-weight:750}.ww-hsub{font-size:9px;opacity:.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ww-hamt{text-align:right}.ww-hvalue{font:700 10px 'Orbitron',sans-serif}.ww-status{font-size:8px;text-transform:uppercase;margin-top:3px}.ww-status.pending{color:#fbbf24}.ww-status.approved,.ww-status.completed{color:#4ade80}.ww-status.rejected{color:#f87171}.ww-loading{padding:40px;text-align:center;opacity:.45}.ww-spin{animation:wwspin 1s linear infinite}@keyframes wwspin{to{transform:rotate(360deg)}}
.ww-confirm-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(2,6,14,.72);backdrop-filter:blur(10px);animation:wwfade .18s ease-out}.ww-confirm{width:min(100%,430px);border-radius:25px;padding:16px;background:linear-gradient(155deg,rgba(29,37,55,.98),rgba(10,15,27,.98));border:1px solid rgba(255,255,255,.13);box-shadow:0 24px 70px rgba(0,0,0,.5);animation:wwsheet .24s cubic-bezier(.2,.8,.2,1)}.ww-confirm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}.ww-confirm-title{font:850 15px 'Orbitron',sans-serif}.ww-confirm-close{width:34px;height:34px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.05);color:inherit;display:grid;place-items:center}.ww-confirm-close svg{width:16px}.ww-confirm-summary{border-radius:18px;padding:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.075)}.ww-confirm-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:9px 1px;border-bottom:1px solid rgba(255,255,255,.055)}.ww-confirm-row:last-child{border-bottom:0}.ww-confirm-key{font-size:10px;opacity:.42}.ww-confirm-value{font-size:11px;font-weight:800;text-align:right;max-width:67%;word-break:break-all}.ww-confirm-amount{color:#86efac}.ww-confirm-adr{color:#ffe28a}.ww-confirm-note{display:flex;gap:8px;margin:11px 1px 0;font-size:10px;line-height:1.45;opacity:.58}.ww-confirm-note svg{width:16px;flex:0 0 16px}.ww-confirm-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:8px;margin-top:14px}.ww-confirm-cancel,.ww-confirm-submit{padding:13px 10px;border-radius:14px;font:800 10px 'Orbitron',sans-serif}.ww-confirm-cancel{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit}.ww-confirm-submit{border:0;background:linear-gradient(135deg,#ffd84d,#f5a400);color:#171006}.ww-confirm-submit:disabled{opacity:.5}@keyframes wwfade{from{opacity:0}to{opacity:1}}@keyframes wwsheet{from{opacity:0;transform:translateY(20px) scale(.985)}to{opacity:1;transform:none}}
[data-theme='light'] .ww-balance,[data-theme='light'] .ww-req,[data-theme='light'] .ww-method,[data-theme='light'] .ww-amount,[data-theme='light'] .ww-rate,[data-theme='light'] .ww-info,[data-theme='light'] .ww-hrow{background:rgba(255,255,255,.92);border-color:rgba(15,23,42,.09);box-shadow:0 12px 28px rgba(45,60,90,.07);color:#0f172a}[data-theme='light'] .ww-track{background:rgba(15,23,42,.08)}[data-theme='light'] .ww-bal{color:#966100}[data-theme='light'] .ww-input{color:#0f172a}[data-theme='light'] .ww-confirm{background:rgba(255,255,255,.98);color:#0f172a;border-color:rgba(15,23,42,.1)}[data-theme='light'] .ww-confirm-summary{background:rgba(15,23,42,.03);border-color:rgba(15,23,42,.07)}[data-theme='light'] .ww-confirm-row{border-color:rgba(15,23,42,.06)}[data-theme='light'] .ww-confirm-close,[data-theme='light'] .ww-confirm-cancel{color:#0f172a;background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.08)}
`;

export default function WalletPage() {
  const { user, balance, settings, refreshBalance } = useApp();
  const { t } = usePreferences();
  const [adCount, setAdCount] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [method, setMethod] = useState<Method>('ton');
  const [selectedPoints, setSelectedPoints] = useState(0);
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ready = Object.keys(settings).length > 0 && adCount !== null;
  const num = (key: string) => Number(settings[key]);
  const flag = (key: string) => String(settings[key] ?? 'true').toLowerCase() !== 'false';
  const minPoints = ready ? Math.max(1, Math.floor(num('min_withdrawal_points'))) : 0;
  const requiredAds = ready ? Math.max(0, Math.floor(num('required_daily_ads'))) : 0;
  const enabled = ready && flag('withdrawal_enabled');
  const methodEnabled: Record<Method, boolean> = {
    ton: ready && flag('withdraw_ton_enabled'),
    usdt_polygon: ready && flag('withdraw_usdt_polygon_enabled'),
    upi: ready && flag('withdraw_upi_enabled'),
  };
  const rates: Record<Method, number> = ready
    ? {
        ton: num('ton_conversion_rate'),
        usdt_polygon: num('usdt_conversion_rate'),
        upi: num('inr_conversion_rate'),
      }
    : { ton: 1, usdt_polygon: 1, upi: 1 };

  const points = balance?.points;
  const presets = useMemo(() => (minPoints ? [1, 2, 3, 4].map(x => minPoints * x) : []), [minPoints]);

  useEffect(() => {
    if (minPoints && selectedPoints < minPoints) setSelectedPoints(minPoints);
  }, [minPoints, selectedPoints]);

  useEffect(() => {
    if (ready && !methodEnabled[method]) {
      const next = METHODS.find(item => methodEnabled[item]);
      if (next) setMethod(next);
    }
  }, [ready, settings, method]);

  const load = async () => {
    if (!user) return;
    const [count, rows] = await Promise.all([getTodayAdCount(), getWithdrawals(user.id)]);
    setAdCount(count);
    setHistory((rows || []).slice(0, 10));
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 10_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [user]);

  if (!ready) {
    return <><style>{CSS}</style><div className="ww-loading"><RefreshCw className="ww-spin" /></div></>;
  }

  const adsComplete = adCount! >= requiredAds;
  const progress = requiredAds === 0 ? 100 : Math.min(100, (adCount! / requiredAds) * 100);
  const safeRate = rates[method] > 0 ? rates[method] : 1;
  const amount = selectedPoints / safeRate;
  const amountText = method === 'ton'
    ? `${amount.toFixed(4)} TON`
    : method === 'usdt_polygon'
      ? `${amount.toFixed(4)} USDT`
      : `₹${amount.toFixed(2)}`;

  const meta: Record<Method, { title: string; sub: string; placeholder: string; Icon: any }> = {
    ton: { title: t('gram'), sub: 'TON · GRAM', placeholder: 'UQ... / EQ...', Icon: Coins },
    usdt_polygon: { title: t('usdtPolygon'), sub: 'Polygon · 0x', placeholder: '0x...', Icon: BadgeDollarSign },
    upi: { title: t('inrUpi'), sub: 'Paytm · PhonePe · GPay', placeholder: 'name@upi', Icon: IndianRupee },
  };

  const canReview = enabled && methodEnabled[method] && points != null && points >= selectedPoints && adsComplete && !submitting && !!address.trim();

  const validate = () => {
    setMessage('');
    setOk(false);
    if (!user || points == null || !methodEnabled[method]) return false;
    const value = address.trim();
    const isValid = method === 'ton' ? validTon(value) : method === 'usdt_polygon' ? validPolygon(value) : validUpi(value);
    if (!isValid) {
      setMessage(method === 'upi' ? t('invalidUpi') : method === 'usdt_polygon' ? t('invalidPolygon') : t('invalidTon'));
      return false;
    }
    if (points < selectedPoints) {
      setMessage(t('notEnoughPoints'));
      return false;
    }
    if (!adsComplete) {
      setMessage(`${requiredAds - adCount!} ${t('moreAds')}`);
      return false;
    }
    return true;
  };

  const reviewWithdrawal = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const confirmWithdrawal = async () => {
    if (!validate() || !user) {
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    const result = await submitWithdrawal(user.id, method, selectedPoints, address.trim());
    setSubmitting(false);
    setMessage(result.message || '');
    setOk(!!result.success);
    if (result.success) {
      setConfirmOpen(false);
      setAddress('');
      await refreshBalance();
      await load();
    }
  };

  const historyAmount = (withdrawal: any) => withdrawal.method === 'upi'
    ? `₹${Number(withdrawal.amount || 0).toFixed(2)}`
    : withdrawal.method === 'usdt_polygon'
      ? `${Number(withdrawal.amount || 0).toFixed(4)} USDT`
      : `${Number(withdrawal.amount || 0).toFixed(4)} TON`;

  const selectedMeta = meta[method];

  return <>
    <style>{CSS}</style>
    <div className="ww-root">
      <div className="ww-head">
        <div className="ww-kicker">GRAM · USDT · INR</div>
        <div className="ww-title">{t('wallet')}</div>
      </div>

      <div className="ww-balance">
        <div className="ww-bal-label">{t('availableBalance')}</div>
        <div className="ww-bal">{points == null ? '•••' : points.toLocaleString()} <small>ADR</small></div>
        <div className="ww-bal-sub">{t('readyWithdraw')}</div>
      </div>

      <div className="ww-req">
        <div className="ww-req-top"><span>{t('dailyAdsProgress')}</span><b>{adCount} / {requiredAds}</b></div>
        <div className="ww-track"><div className="ww-fill" style={{ width: `${progress}%` }} /></div>
        <div className={`ww-req-msg ${adsComplete ? 'ok' : ''}`}>
          {adsComplete ? t('requirementMet') : `${Math.max(0, requiredAds - adCount!)} ${t('moreAds')}`}
        </div>
      </div>

      <div className="ww-sec">{t('withdraw')} · {t('network')}</div>
      <div className="ww-methods">
        {METHODS.map(item => {
          const option = meta[item];
          const Icon = option.Icon;
          const active = methodEnabled[item];
          return <button
            key={item}
            disabled={!active}
            className={`ww-method ${method === item && active ? 'active' : ''} ${!active ? 'disabled' : ''}`}
            onClick={() => {
              if (!active) return;
              setMethod(item);
              setAddress('');
              setMessage('');
              setConfirmOpen(false);
            }}
          >
            <div className="ww-logo">
              <Icon />
              <img src={LOGOS[item]} alt={option.title} referrerPolicy="no-referrer" onError={event => event.currentTarget.classList.add('asset-failed')} />
            </div>
            <div className="ww-mi">
              <div className="ww-mtitle">{option.title}</div>
              <div className="ww-msub">{option.sub}</div>
              {!active && <div className="ww-disabled">Temporarily unavailable</div>}
            </div>
            {!active ? <LockKeyhole /> : method === item ? <CheckCircle2 /> : <ChevronRight />}
          </button>;
        })}
      </div>

      <div className="ww-sec">{t('selectAmount')} · {t('minimum')} {minPoints.toLocaleString()} ADR</div>
      <div className="ww-amounts">
        {presets.map(value => <button
          key={value}
          className={`ww-amount ${selectedPoints === value ? 'active' : ''}`}
          onClick={() => {
            setSelectedPoints(value);
            setConfirmOpen(false);
          }}
        >
          <div className="ww-apts">{value.toLocaleString()} ADR</div>
          <div className="ww-aval">
            {method === 'ton'
              ? `${(value / safeRate).toFixed(4)} TON`
              : method === 'usdt_polygon'
                ? `${(value / safeRate).toFixed(4)} USDT`
                : `₹${(value / safeRate).toFixed(2)}`}
          </div>
        </button>)}
      </div>

      <div className="ww-rate"><span>{t('rate')}</span><span>{safeRate.toLocaleString()} ADR = {method === 'ton' ? '1 TON' : method === 'usdt_polygon' ? '1 USDT' : '₹1'}</span></div>

      <div className="ww-sec">{method === 'upi' ? t('upiId') : t('walletAddress')}</div>
      <input
        className="ww-input"
        value={address}
        onChange={event => {
          setAddress(event.target.value);
          setMessage('');
          setConfirmOpen(false);
        }}
        placeholder={selectedMeta.placeholder}
        disabled={!methodEnabled[method]}
        autoCapitalize="none"
        autoCorrect="off"
      />

      <button className="ww-submit" disabled={!canReview} onClick={reviewWithdrawal}>
        Review Withdrawal · {amountText}
      </button>

      {!enabled && <div className="ww-message err">{t('withdrawDisabled')}</div>}
      {message && <div className={`ww-message ${ok ? 'ok' : 'err'}`}>{message.replace(/\b(?:points?|pts)\b/gi, 'ADR')}</div>}

      <div className="ww-info"><ShieldCheck /><span>{t('withdrawGuideText')}</span></div>

      <div className="ww-sec"><Clock3 style={{ width: 13, verticalAlign: 'middle' }} /> {t('history')}</div>
      <div className="ww-history">
        {history.length === 0
          ? <div className="ww-info">{t('noWithdrawals')}</div>
          : history.map(withdrawal => <div className="ww-hrow" key={withdrawal.id}>
              <div className="ww-hicon">
                {withdrawal.method === 'upi' ? <IndianRupee /> : withdrawal.method === 'usdt_polygon' ? <BadgeDollarSign /> : <Coins />}
              </div>
              <div className="ww-hbody">
                <div className="ww-htitle">{withdrawal.method === 'upi' ? t('inrUpi') : withdrawal.method === 'usdt_polygon' ? t('usdtPolygon') : t('gram')}</div>
                <div className="ww-hsub">{Number(withdrawal.points_spent || 0).toLocaleString()} ADR · {withdrawal.wallet_address || ''}</div>
              </div>
              <div className="ww-hamt">
                <div className="ww-hvalue">{historyAmount(withdrawal)}</div>
                <div className={`ww-status ${String(withdrawal.status || 'pending').toLowerCase()}`}>
                  {t(String(withdrawal.status || 'pending').toLowerCase())}
                </div>
              </div>
            </div>)}
      </div>
    </div>

    {confirmOpen && <div className="ww-confirm-backdrop" role="presentation" onClick={() => !submitting && setConfirmOpen(false)}>
      <div className="ww-confirm" role="dialog" aria-modal="true" aria-label="Confirm withdrawal" onClick={event => event.stopPropagation()}>
        <div className="ww-confirm-head">
          <div className="ww-confirm-title">Confirm Withdrawal</div>
          <button className="ww-confirm-close" disabled={submitting} onClick={() => setConfirmOpen(false)} aria-label="Close"><X /></button>
        </div>

        <div className="ww-confirm-summary">
          <div className="ww-confirm-row"><span className="ww-confirm-key">Method</span><span className="ww-confirm-value">{selectedMeta.title}</span></div>
          <div className="ww-confirm-row"><span className="ww-confirm-key">You receive</span><span className="ww-confirm-value ww-confirm-amount">{amountText}</span></div>
          <div className="ww-confirm-row"><span className="ww-confirm-key">ADR deducted</span><span className="ww-confirm-value ww-confirm-adr">{selectedPoints.toLocaleString()} ADR</span></div>
          <div className="ww-confirm-row"><span className="ww-confirm-key">{method === 'upi' ? 'UPI ID' : 'Wallet'}</span><span className="ww-confirm-value">{address.trim()}</span></div>
        </div>

        <div className="ww-confirm-note"><ShieldCheck /><span>Please verify the amount and {method === 'upi' ? 'UPI ID' : 'wallet address'} carefully before submitting.</span></div>

        <div className="ww-confirm-actions">
          <button className="ww-confirm-cancel" disabled={submitting} onClick={() => setConfirmOpen(false)}>Cancel</button>
          <button className="ww-confirm-submit" disabled={submitting} onClick={() => void confirmWithdrawal()}>{submitting ? 'Submitting…' : 'Confirm Withdraw'}</button>
        </div>
      </div>
    </div>}
  </>;
}
