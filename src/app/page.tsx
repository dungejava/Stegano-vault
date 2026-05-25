'use client';

import { useState, useRef, useEffect } from 'react';
import HideTab from '@/components/HideTab';
import RevealTab from '@/components/RevealTab';
import ShamirTab from '@/components/ShamirTab';

type Tab = 'hide' | 'reveal' | 'shamir';

const ACCESS_PASSWORD = 'fuckprofessors';
const SESSION_KEY = 'sv_auth';

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setAttempts(a => a + 1);
      setInput('');
      setTimeout(() => setShake(false), 600);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Decorative grid lines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,255,159,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,159,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className={`w-full max-w-sm relative transition-all ${shake ? 'animate-[shake_0.5s_ease]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease' } : {}}>

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-signal/30 rounded mb-4"
            style={{ boxShadow: '0 0 30px rgba(0,255,159,0.1)' }}>
            <span className="text-signal text-2xl">⬡</span>
          </div>
          <h1 className="font-display text-2xl tracking-widest text-paper glitch" data-text="STEGOVAULT">
            STEGOVAULT
          </h1>
          <p className="text-xs text-paper/25 font-mono tracking-widest mt-1">RESTRICTED ACCESS</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-paper/40 font-mono tracking-widest mb-2">
              ACCESS KEY
            </label>
            <input
              ref={inputRef}
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              className={`input-field w-full rounded p-3 text-sm tracking-widest ${
                error ? 'border-warn/60 shadow-[0_0_10px_rgba(255,59,59,0.2)]' : ''
              }`}
              placeholder="••••••••••••••"
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="text-warn text-xs font-mono mt-1.5 animate-fade-in">
                ✗ ACCESS DENIED{attempts > 2 ? ` (${attempts} attempts)` : ''}
              </p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full py-3 rounded text-sm tracking-widest">
            AUTHENTICATE →
          </button>
        </form>

        {/* Decorative */}
        <div className="mt-10 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-xs text-paper/15 font-mono">AES-256 · LSB · SHAMIR</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [authed, setAuthed] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [activeTab, setActiveTab] = useState<Tab>('hide');

  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;

  const tabs: { id: Tab; label: string; glyph: string }[] = [
    { id: 'hide', label: 'HIDE', glyph: '◉' },
    { id: 'reveal', label: 'REVEAL', glyph: '◎' },
    { id: 'shamir', label: 'SHAMIR', glyph: '⬡' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full dot-red inline-block" />
            <span className="w-3 h-3 rounded-full dot-yellow inline-block" />
            <span className="w-3 h-3 rounded-full dot-green inline-block" />
          </div>
          <div>
            <h1
              className="font-display text-xl font-800 text-paper tracking-widest glitch"
              data-text="STEGOVAULT"
            >
              STEGOVAULT
            </h1>
            <p className="text-xs text-paper/30 tracking-widest mt-0.5">AES-256 · LSB · SHAMIR</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-paper/30 font-mono">
          <span className="w-1.5 h-1.5 rounded-full dot-green inline-block" />
          CLIENT-SIDE ONLY — NO SERVER
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-white/10 px-6 flex gap-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 text-xs font-mono tracking-widest transition-all duration-150 flex items-center gap-2 ${
              activeTab === tab.id
                ? 'tab-active text-signal'
                : 'text-paper/40 hover:text-paper/70 border-b-2 border-transparent'
            }`}
          >
            <span className="text-base leading-none">{tab.glyph}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto animate-fade-in">
          {activeTab === 'hide' && <HideTab />}
          {activeTab === 'reveal' && <RevealTab />}
          {activeTab === 'shamir' && <ShamirTab />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-3 flex items-center justify-between text-xs text-paper/20 font-mono">
        <span>ALL CRYPTO RUNS IN YOUR BROWSER — ZERO DATA LEAVES YOUR DEVICE</span>
        <a
          href="https://github.com/YOUR_USER/stegovault"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-signal transition-colors"
        >
          GITHUB ↗
        </a>
      </footer>
    </div>
  );
}
