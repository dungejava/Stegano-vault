'use client';

import { useState } from 'react';
import { shamirSplitPassword, shamirReconstructPassword } from '@/lib/stego';

type Mode = 'split' | 'join';

export default function ShamirTab() {
  const [mode, setMode] = useState<Mode>('split');

  // Split
  const [password, setPassword] = useState('');
  const [n, setN] = useState(5);
  const [k, setK] = useState(3);
  const [shares, setShares] = useState<string[]>([]);
  const [splitStatus, setSplitStatus] = useState('');
  const [splitError, setSplitError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Join
  const [shareInputs, setShareInputs] = useState<string[]>(['', '', '']);
  const [reconstructed, setReconstructed] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinStatus, setJoinStatus] = useState('');

  function handleSplit() {
    setSplitError('');
    setShares([]);
    setSplitStatus('');
    if (!password) { setSplitError('Enter a password to split.'); return; }
    if (k > n) { setSplitError('Threshold k cannot exceed total shares n.'); return; }
    try {
      const result = shamirSplitPassword(password, n, k);
      setShares(result);
      setSplitStatus(`Split into ${n} shares, any ${k} can reconstruct.`);
    } catch (err: unknown) {
      setSplitError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function copyShare(idx: number) {
    await navigator.clipboard.writeText(shares[idx]);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function copyAllShares() {
    const text = shares.map((s, i) => `Share ${i + 1}/${n} [k=${k}]: ${s}`).join('\n');
    await navigator.clipboard.writeText(text);
  }

  function handleJoin() {
    setJoinError('');
    setReconstructed('');
    setJoinStatus('');
    const valid = shareInputs.filter(s => s.trim().length > 0);
    if (valid.length < 2) { setJoinError('Enter at least 2 shares.'); return; }
    try {
      const result = shamirReconstructPassword(valid, valid.length);
      setReconstructed(result);
      setJoinStatus(`Reconstructed from ${valid.length} shares.`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Reconstruction failed — check shares');
    }
  }

  function addShareInput() {
    setShareInputs(prev => [...prev, '']);
  }

  function removeShareInput(idx: number) {
    setShareInputs(prev => prev.filter((_, i) => i !== idx));
  }

  function updateShareInput(idx: number, val: string) {
    setShareInputs(prev => prev.map((s, i) => i === idx ? val : s));
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <p className="text-paper/40 text-xs font-mono leading-relaxed mb-4">
          Shamir&apos;s Secret Sharing (SSS) over GF(256). Split a password into N shares so that
          any K of them reconstruct it — without leaking anything with fewer than K shares.
        </p>

        <div className="flex gap-2">
          {(['split', 'join'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-xs font-mono tracking-wider transition-all ${
                mode === m ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              {m === 'split' ? '⬡ SPLIT' : '⬡ RECONSTRUCT'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'split' ? (
        <div className="space-y-5">
          {/* Password input */}
          <div>
            <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
              PASSWORD TO SPLIT
            </label>
            <input
              type="text"
              className="input-field w-full rounded p-3 text-sm font-mono"
              placeholder="The AES password you used (or will use)…"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {/* N and K */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
                TOTAL SHARES (N)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={2} max={20} value={n}
                  onChange={e => setN(Number(e.target.value))}
                  className="flex-1 accent-signal"
                />
                <span className="text-signal font-mono font-600 text-xl w-8 text-right">{n}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
                THRESHOLD (K)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={2} max={n} value={Math.min(k, n)}
                  onChange={e => setK(Number(e.target.value))}
                  className="flex-1 accent-signal"
                />
                <span className="text-signal font-mono font-600 text-xl w-8 text-right">{Math.min(k, n)}</span>
              </div>
            </div>
          </div>

          {/* Visual schema */}
          <div className="border border-white/10 rounded p-4 bg-white/2">
            <p className="text-xs text-paper/30 font-mono mb-3">SCHEMA PREVIEW</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: n }, (_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono transition-all ${
                    i < Math.min(k, n)
                      ? 'bg-signal text-ink font-600'
                      : 'border border-white/20 text-paper/30'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="text-xs text-paper/25 font-mono mt-3">
              Any <span className="text-signal">{Math.min(k, n)}</span> highlighted shares reconstruct the secret.
              Fewer than {Math.min(k, n)} reveal nothing.
            </p>
          </div>

          <button
            onClick={handleSplit}
            disabled={!password}
            className="btn-primary w-full py-3 rounded text-sm tracking-widest"
          >
            ⬡ SPLIT SECRET
          </button>

          {splitError && (
            <div className="rounded p-3 text-xs font-mono border border-warn/30 bg-warn/5 text-warn">
              ✗ {splitError}
            </div>
          )}

          {shares.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-paper/50 font-mono tracking-widest">SHARES</p>
                <button
                  onClick={copyAllShares}
                  className="text-xs font-mono text-paper/40 hover:text-signal transition-colors px-2 py-1 border border-white/10 rounded"
                >
                  COPY ALL
                </button>
              </div>
              {splitStatus && (
                <p className="text-xs text-signal font-mono">✓ {splitStatus}</p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {shares.map((share, i) => (
                  <div key={i} className="share-card rounded p-3 flex items-start gap-3">
                    <span className="text-signal text-xs font-mono font-600 shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-paper/60 text-xs font-mono break-all flex-1 leading-relaxed">
                      {share}
                    </span>
                    <button
                      onClick={() => copyShare(i)}
                      className="text-xs font-mono text-paper/30 hover:text-signal transition-colors shrink-0"
                    >
                      {copiedIdx === i ? '✓' : 'CP'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-paper/20 font-mono leading-relaxed">
                ⚠ Distribute shares to different trusted parties. Never store all shares together.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-paper/40 text-xs font-mono">
            Paste the minimum required shares (K) to reconstruct the password.
          </p>

          <div className="space-y-2">
            {shareInputs.map((val, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-signal text-xs font-mono w-5 shrink-0 text-right">{i + 1}</span>
                <input
                  type="text"
                  className="input-field flex-1 rounded p-2.5 text-xs font-mono"
                  placeholder={`Share ${i + 1}…`}
                  value={val}
                  onChange={e => updateShareInput(i, e.target.value)}
                />
                {shareInputs.length > 2 && (
                  <button
                    onClick={() => removeShareInput(i)}
                    className="text-paper/30 hover:text-warn transition-colors text-xs font-mono px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addShareInput}
            className="btn-ghost w-full py-2 rounded text-xs tracking-wider"
          >
            + ADD SHARE
          </button>

          <button
            onClick={handleJoin}
            disabled={shareInputs.filter(s => s.trim()).length < 2}
            className="btn-primary w-full py-3 rounded text-sm tracking-widest"
          >
            ⬡ RECONSTRUCT SECRET
          </button>

          {joinError && (
            <div className="rounded p-3 text-xs font-mono border border-warn/30 bg-warn/5 text-warn">
              ✗ {joinError}
            </div>
          )}

          {reconstructed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-paper/50 font-mono tracking-widest">
                  RECONSTRUCTED PASSWORD
                </label>
                <button
                  onClick={() => navigator.clipboard.writeText(reconstructed)}
                  className="text-xs font-mono text-paper/40 hover:text-signal transition-colors px-2 py-1 border border-white/10 rounded"
                >
                  COPY
                </button>
              </div>
              {joinStatus && (
                <p className="text-xs text-signal font-mono">✓ {joinStatus}</p>
              )}
              <div className="input-field rounded p-4 text-sm font-mono break-all select-all">
                {reconstructed}
              </div>
              <p className="text-xs text-paper/25 font-mono">
                Use this password in the Reveal tab to decrypt your hidden message.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
