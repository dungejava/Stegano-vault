'use client';

import { useState, useRef, useCallback } from 'react';
import {
  encryptAES256,
  embedInImage,
  embedInFile,
  estimateImageCapacity,
  formatBytes,
} from '@/lib/stego';

type Mode = 'lsb' | 'file';

export default function HideTab() {
  const [mode, setMode] = useState<Mode>('lsb');
  const [carrier, setCarrier] = useState<File | null>(null);
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [carrierDims, setCarrierDims] = useState<{ w: number; h: number } | null>(null);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [hiddenExt, setHiddenExt] = useState('txt');
  const [bitsPerChannel, setBitsPerChannel] = useState<1 | 2>(1);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; msg: string }>({ type: 'idle', msg: '' });
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setCarrier(file);
    setOutputUrl(null);
    setStatus({ type: 'idle', msg: '' });
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setCarrierPreview(url);
      const img = new Image();
      img.onload = () => setCarrierDims({ w: img.width, h: img.height });
      img.src = url;
    } else {
      setCarrierPreview(null);
      setCarrierDims(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const capacity = carrierDims
    ? estimateImageCapacity(carrierDims.w, carrierDims.h, bitsPerChannel)
    : null;

  const msgBytes = new TextEncoder().encode(message).length;
  const usedPct = capacity ? Math.min(100, (msgBytes / capacity) * 100) : 0;

  async function handleEmbed() {
    if (!carrier || !message || !password) {
      setStatus({ type: 'error', msg: 'Carrier file, message, and password are required.' });
      return;
    }
    setStatus({ type: 'loading', msg: 'Encrypting with AES-256…' });
    setOutputUrl(null);

    try {
      const encrypted = await encryptAES256(message, password);

      let blob: Blob;
      let name: string;

      if (mode === 'lsb') {
        setStatus({ type: 'loading', msg: 'Embedding bits into pixels…' });
        blob = await embedInImage(carrier, encrypted, bitsPerChannel);
        name = carrier.name.replace(/\.[^.]+$/, '') + '_stego.png';
      } else {
        setStatus({ type: 'loading', msg: 'Appending hidden data to file…' });
        blob = await embedInFile(carrier, encrypted, hiddenExt);
        name = carrier.name;
      }

      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setOutputName(name);
      setStatus({ type: 'success', msg: `Done! Hidden payload: ${formatBytes(msgBytes)} encrypted` });
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <p className="text-paper/40 text-xs font-mono mb-4 leading-relaxed">
          Encrypt your message with AES-256, then hide it inside an image (LSB pixel manipulation)
          or append it to any file (rename-to-reveal).
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
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
      </div>

      {/* Carrier drop zone */}
      <div>
        <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
          {mode === 'lsb' ? 'CARRIER IMAGE (PNG / JPG / BMP)' : 'CARRIER FILE (ANY FORMAT)'}
        </label>
        <div
          className={`drop-zone rounded p-6 text-center cursor-pointer relative ${dragging ? 'drag-over' : ''}`}
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
          {carrier ? (
            <div className="space-y-2">
              {carrierPreview && (
                <img
                  src={carrierPreview}
                  alt="carrier"
                  className="max-h-32 mx-auto rounded object-contain"
                />
              )}
              <p className="text-signal text-xs font-mono">{carrier.name}</p>
              <p className="text-paper/30 text-xs">
                {formatBytes(carrier.size)}
                {carrierDims ? ` · ${carrierDims.w}×${carrierDims.h}px` : ''}
                {capacity ? ` · capacity ≈ ${formatBytes(capacity)}` : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl text-paper/10">⬡</div>
              <p className="text-paper/30 text-xs font-mono">DROP FILE HERE OR CLICK</p>
            </div>
          )}
        </div>

        {/* Capacity bar */}
        {capacity && (
          <div className="mt-2">
            <div className="progress-bar rounded-full overflow-hidden">
              <div
                className="progress-fill rounded-full"
                style={{
                  width: `${usedPct}%`,
                  background: usedPct > 90 ? 'var(--warn)' : 'var(--signal)',
                }}
              />
            </div>
            <p className="text-xs text-paper/30 font-mono mt-1">
              {formatBytes(msgBytes)} / {formatBytes(capacity)} capacity ({usedPct.toFixed(1)}%)
            </p>
          </div>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
          SECRET MESSAGE
        </label>
        <textarea
          className="input-field w-full rounded p-3 text-sm resize-none h-28"
          placeholder="Enter the message to hide…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
          AES-256 PASSWORD
        </label>
        <input
          type="password"
          className="input-field w-full rounded p-3 text-sm"
          placeholder="Strong password (use Shamir tab to split it)"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {/* Mode-specific options */}
      {mode === 'lsb' ? (
        <div>
          <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
            BITS PER CHANNEL
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
                {b === 1 ? '1-BIT (INVISIBLE)' : '2-BIT (2× CAPACITY)'}
              </button>
            ))}
          </div>
          <p className="text-xs text-paper/25 font-mono mt-1.5">
            1-bit: changes are imperceptible. 2-bit: doubles space, slight quality loss.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-paper/50 font-mono mb-2 tracking-widest">
            HIDDEN EXTENSION (rename file to reveal)
          </label>
          <div className="flex gap-2">
            {['txt', 'md', 'pdf', 'json', 'xml'].map(ext => (
              <button
                key={ext}
                onClick={() => setHiddenExt(ext)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${
                  hiddenExt === ext ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                .{ext}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <button
        onClick={handleEmbed}
        disabled={!carrier || !message || !password || status.type === 'loading'}
        className="btn-primary w-full py-3 rounded text-sm tracking-widest"
      >
        {status.type === 'loading' ? status.msg : '◉ EMBED & ENCRYPT'}
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
          {status.msg}
        </div>
      )}

      {/* Download */}
      {outputUrl && (
        <a
          href={outputUrl}
          download={outputName}
          className="btn-primary block text-center py-3 rounded text-sm tracking-widest no-underline"
        >
          ↓ DOWNLOAD STEGO FILE
        </a>
      )}
    </div>
  );
}
