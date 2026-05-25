'use client';

import { useState, useRef, useCallback } from 'react';
import {
  decryptAES256,
  extractFromImage,
  extractFromFile,
  formatBytes,
} from '@/lib/stego';

type Mode = 'lsb' | 'file';

export default function RevealTab() {
  const [mode, setMode] = useState<Mode>('lsb');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [bitsPerChannel, setBitsPerChannel] = useState<1 | 2>(1);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; msg: string }>({ type: 'idle', msg: '' });
  const [revealed, setRevealed] = useState<string | null>(null);
  const [hiddenExt, setHiddenExt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setRevealed(null);
    setStatus({ type: 'idle', msg: '' });
    if (f.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function handleReveal() {
    if (!file || !password) {
      setStatus({ type: 'error', msg: 'File and password are required.' });
      return;
    }
    setStatus({ type: 'loading', msg: mode === 'lsb' ? 'Reading pixel LSBs…' : 'Scanning file trailer…' });
    setRevealed(null);

    try {
      let encrypted: string;

      if (mode === 'lsb') {
        encrypted = await extractFromImage(file, bitsPerChannel);
      } else {
        const result = await extractFromFile(file);
        encrypted = result.payload;
        setHiddenExt(result.hiddenExt);
      }

      setStatus({ type: 'loading', msg: 'Decrypting AES-256…' });
      const plaintext = await decryptAES256(encrypted, password);
      setRevealed(plaintext);
      setStatus({ type: 'success', msg: `Revealed ${new TextEncoder().encode(plaintext).length} bytes` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('operation-specific')) {
        setStatus({ type: 'error', msg: 'Wrong password — decryption failed' });
      } else {
        setStatus({ type: 'error', msg: msg });
      }
    }
  }

  async function handleCopy() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <p className="text-paper/40 text-xs font-mono leading-relaxed">
        Extract and decrypt a hidden message from a steganographic file. Must use the same
        method and password used during embedding.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['lsb', 'file'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-xs font-mono tracking-wider transition-all ${
              mode === m ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            {m === 'lsb' ? '◉ LSB IMAGE' : '◎ FILE APPEND'}
          </button>
        ))}
      </div>

      {/* File drop */}
      <div>
        <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
          STEGO FILE
        </label>
        <div
          className={`drop-zone rounded p-6 text-center cursor-pointer ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={mode === 'lsb' ? 'image/*' : '*'}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="space-y-2">
              {filePreview && (
                <img src={filePreview} alt="stego" className="max-h-32 mx-auto rounded object-contain" />
              )}
              <p className="text-signal text-xs font-mono">{file.name}</p>
              <p className="text-paper/30 text-xs">{formatBytes(file.size)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl text-paper/10">◎</div>
              <p className="text-paper/30 text-xs font-mono">DROP STEGO FILE HERE OR CLICK</p>
            </div>
          )}
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
          AES-256 PASSWORD
        </label>
        <input
          type="password"
          className="input-field w-full rounded p-3 text-sm"
          placeholder="Password used during embedding…"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {/* LSB bits option */}
      {mode === 'lsb' && (
        <div>
          <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
            BITS PER CHANNEL (must match embedding)
          </label>
          <div className="flex gap-2">
            {([1, 2] as const).map(b => (
              <button
                key={b}
                onClick={() => setBitsPerChannel(b)}
                className={`px-4 py-2 text-xs font-mono transition-all ${
                  bitsPerChannel === b ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                {b}-BIT
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reveal button */}
      <button
        onClick={handleReveal}
        disabled={!file || !password || status.type === 'loading'}
        className="btn-primary w-full py-3 rounded text-sm tracking-widest"
      >
        {status.type === 'loading' ? status.msg : '◎ EXTRACT & DECRYPT'}
      </button>

      {/* Status */}
      {status.type !== 'idle' && status.type !== 'loading' && (
        <div
          className={`rounded p-3 text-xs font-mono border ${
            status.type === 'success'
              ? 'border-signal/30 bg-signal/5 text-signal'
              : 'border-warn/30 bg-warn/5 text-warn'
          }`}
        >
          {status.type === 'success' ? '✓ ' : '✗ '}{status.msg}
        </div>
      )}

      {/* Hidden ext info for file mode */}
      {hiddenExt && mode === 'file' && (
        <div className="text-xs font-mono text-paper/40 border border-white/10 rounded p-3">
          Hidden extension detected: <span className="text-signal">.{hiddenExt}</span>
          <span className="text-paper/25 ml-2">— rename the file to reveal it directly</span>
        </div>
      )}

      {/* Revealed message */}
      {revealed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-paper/50 font-mono tracking-widest">
              DECRYPTED MESSAGE
            </label>
            <button
              onClick={handleCopy}
              className="text-xs font-mono text-paper/40 hover:text-signal transition-colors px-2 py-1 border border-white/10 rounded"
            >
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
          </div>
          <div className="input-field rounded p-4 text-sm whitespace-pre-wrap break-words min-h-[80px] select-all">
            {revealed}
          </div>
        </div>
      )}
    </div>
  );
}
