import { useState, useRef, useEffect } from 'react';
import { requestAdminOTP, verifyAdminOTP } from '@/lib/api';
import { useApp } from '@/context/AppContext';

interface AdminOTPLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AdminOTPLogin({ onSuccess, onCancel }: AdminOTPLoginProps) {
  const { telegramUser } = useApp();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  async function handleRequestOTP() {
    if (!telegramUser) return;
    setLoading(true);
    setError('');
    const res = await requestAdminOTP(telegramUser.id);
    setLoading(false);
    if (res.success) {
      setStep('verify');
      setCountdown(300);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else {
      setError(res.message || 'Failed to send OTP');
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length !== 6) return;
    if (!telegramUser) return;
    setLoading(true);
    setError('');
    const res = await verifyAdminOTP(telegramUser.id, code);
    setLoading(false);
    if (res.success && res.token) {
      sessionStorage.setItem('admin_token', res.token);
      onSuccess();
    } else {
      setError(res.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#06080f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,190,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,190,0,0.02) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}/>

      {/* Orb */}
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,190,0,0.06) 0%, transparent 70%)',
        width: 320, height: 320, top: -80, left: '50%', transform: 'translateX(-50%)',
      }}/>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 340 }}>

        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
            background: 'rgba(255,190,0,0.08)',
            border: '1px solid rgba(255,190,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>🔐</div>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: 16, fontWeight: 900,
            letterSpacing: 3, color: '#ffbe00', marginBottom: 6,
          }}>ADMIN ACCESS</div>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 3,
            color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
          }}>
            {step === 'request' ? 'Secure OTP Verification' : 'Enter the code sent to your bot'}
          </div>
        </div>

        {step === 'request' ? (
          <>
            <div style={{
              background: 'rgba(255,190,0,0.04)', border: '1px solid rgba(255,190,0,0.12)',
              borderRadius: 14, padding: '16px 20px', marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontFamily: "'Rajdhani',sans-serif" }}>
                An OTP will be sent to your Telegram bot private chat. Click below to request it.
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 16, textAlign: 'center',
                color: '#ef4444', fontSize: 12, fontFamily: "'Rajdhani',sans-serif",
              }}>{error}</div>
            )}

            <button
              onClick={handleRequestOTP}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(255,190,0,0.3)' : 'linear-gradient(135deg, #ffbe00, #f59e0b)',
                color: '#06080f', fontFamily: "'Orbitron',monospace", fontSize: 11,
                fontWeight: 700, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 12,
              }}
            >
              {loading ? 'SENDING···' : '📨  SEND OTP TO BOT'}
            </button>

            <button
              onClick={onCancel}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron',monospace",
                fontSize: 9, letterSpacing: 2, cursor: 'pointer',
              }}
            >CANCEL</button>
          </>
        ) : (
          <>
            {/* OTP inputs */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  style={{
                    width: 44, height: 54, borderRadius: 10, textAlign: 'center',
                    fontSize: 22, fontWeight: 700, fontFamily: "'Orbitron',monospace",
                    background: digit ? 'rgba(255,190,0,0.1)' : 'rgba(255,255,255,0.04)',
                    border: digit ? '1.5px solid rgba(255,190,0,0.4)' : '1.5px solid rgba(255,255,255,0.08)',
                    color: '#ffbe00', outline: 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>

            {/* Countdown */}
            {countdown > 0 && (
              <div style={{ textAlign: 'center', marginBottom: 16, fontFamily: "'Orbitron',monospace", fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>
                EXPIRES IN {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            )}
            {countdown === 0 && (
              <div style={{ textAlign: 'center', marginBottom: 16, color: '#ef4444', fontSize: 11, fontFamily: "'Rajdhani',sans-serif" }}>
                OTP expired. Please request a new one.
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 16, textAlign: 'center',
                color: '#ef4444', fontSize: 12, fontFamily: "'Rajdhani',sans-serif",
              }}>{error}</div>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || otp.join('').length !== 6 || countdown === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: otp.join('').length === 6 && countdown > 0
                  ? 'linear-gradient(135deg, #ffbe00, #f59e0b)'
                  : 'rgba(255,190,0,0.15)',
                color: otp.join('').length === 6 && countdown > 0 ? '#06080f' : 'rgba(255,190,0,0.4)',
                fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700,
                letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 10,
              }}
            >
              {loading ? 'VERIFYING···' : '✅  VERIFY & ENTER'}
            </button>

            <button
              onClick={() => { setStep('request'); setOtp(['','','','','','']); setError(''); }}
              style={{
                width: '100%', padding: '10px', borderRadius: 12,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.25)', fontFamily: "'Orbitron',monospace",
                fontSize: 8, letterSpacing: 2, cursor: 'pointer', marginBottom: 8,
              }}
            >RESEND OTP</button>

            <button
              onClick={onCancel}
              style={{
                width: '100%', padding: '10px', borderRadius: 12,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.2)', fontFamily: "'Orbitron',monospace",
                fontSize: 8, letterSpacing: 2, cursor: 'pointer',
              }}
            >CANCEL</button>
          </>
        )}
      </div>
    </div>
  );
}
