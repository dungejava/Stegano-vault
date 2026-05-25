# StegoVault 🔐

> **Hidden in plain sight.** AES-256 steganography with Shamir's Secret Sharing — runs 100% in your browser.

![StegoVault](https://img.shields.io/badge/AES--256-GCM-00ff9f?style=flat-square) ![Shamir](https://img.shields.io/badge/Shamir-SSS%20GF(256)-00ff9f?style=flat-square) ![Zero%20Server](https://img.shields.io/badge/Server-None-ff3b3b?style=flat-square)

## Features

| Feature | Details |
|---|---|
| **LSB Steganography** | Hides encrypted data in the least-significant bits of image pixels (RGB channels). 1-bit mode is imperceptible; 2-bit doubles capacity. |
| **File Append** | Appends hidden data after any file's valid bytes. Rename `.jpg` → `.txt` to reveal. Supports `.pdf`, `.md`, `.txt`, `.json`, `.xml`. |
| **AES-256-GCM** | SubtleCrypto API. PBKDF2 key derivation (250,000 iterations, SHA-256). Random salt + IV per encryption. |
| **Shamir SSS** | Pure-JS over GF(256). Split a password into N shares; any K reconstruct it. Threshold scheme — fewer than K shares reveal nothing. |
| **Zero Server** | All crypto and steganography happens client-side. No data is ever transmitted. |

## Architecture

```
User Browser
├── Hide Tab
│   ├── AES-256-GCM encrypt (SubtleCrypto)
│   ├── LSB embed into PNG pixels (Canvas API)
│   └── File append steganography (ArrayBuffer)
├── Reveal Tab
│   ├── LSB extract from image pixels
│   ├── File trailer scan
│   └── AES-256-GCM decrypt
└── Shamir Tab
    ├── Split: password → N shares (GF(256) polynomial)
    └── Join: K shares → reconstruct password
```

## Workflow

```
Secret message
    ↓
AES-256-GCM encrypt (password)
    ↓
Embed in image (LSB) or file (append)
    ↓
Share steganographic file freely
    ↓
Receiver extracts + decrypts with password
    ↓
(Optional) Password was split via Shamir SSS
  → Requires K out of N shares to reconstruct
```

## Deploy to Vercel

### Option A — One click
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USER/stegovault)

### Option B — CLI
```bash
git clone https://github.com/YOUR_USER/stegovault
cd stegovault
npm install
npx vercel --prod
```

## Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial StegoVault"
git branch -M main
git remote add origin https://github.com/YOUR_USER/stegovault.git
git push -u origin main
```

## Security Notes

- AES-256-GCM provides authenticated encryption — tampering is detected.
- PBKDF2 with 250,000 iterations makes brute-force expensive.
- Shamir SSS is information-theoretically secure with fewer than K shares.
- LSB steganography is not detectable by eye but **can** be detected by steganalysis tools. For higher deniability, use large images with 1-bit mode.
- The file-append method survives casual inspection but not a hex editor.

## License

MIT — use freely, credit appreciated.
