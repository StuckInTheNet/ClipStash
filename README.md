<p align="center">
  <img src="src-tauri/icons/app-icon.png" width="120" alt="ClipStash" />
</p>

<h1 align="center">ClipStash</h1>

<p align="center">
  <strong>A fast, local-first clipboard history manager for macOS and Windows.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#license">License</a>
</p>

---

## What is ClipStash?

ClipStash runs quietly in the background, capturing everything you copy — text, links, code snippets, color values, and screenshots. Search, organize, and paste anything back in seconds.

No cloud. No account. Everything stays on your machine.

## Features

- **Clipboard monitoring** — Automatically captures text, links, code, colors, and screenshots
- **Instant search** — Find any clip with full-text search (`Cmd+F`)
- **Smart detection** — Auto-classifies content as text, link, code, or color
- **Screenshot capture** — Takes a snapshot when you copy images to the clipboard
- **Folders** — Organize clips into custom folders with color coding
- **Favorites** — Star important clips so they're easy to find
- **Sensitive content detection** — Flags passwords, API keys, and tokens
- **Source app tracking** — See which app you copied from
- **23 themes** — Dark and light themes including Dracula, Nord, Tokyo Night, Catppuccin, and more
- **Global hotkey** — `Cmd+Shift+V` (macOS) / `Ctrl+Shift+V` (Windows) to open from anywhere
- **Tiny footprint** — Built with Tauri, uses ~30MB RAM

## Installation

### Download

Grab the latest build from [Releases](../../releases):

| Platform | Download |
|----------|----------|
| **macOS (Apple Silicon)** | [ClipStash-macos-arm64.zip](../../releases/latest/download/ClipStash-macos-arm64.zip) |
| **Windows** | Coming soon |

> **macOS note:** The app is unsigned. On first launch, right-click and select "Open" to bypass Gatekeeper.

### Build from source

**Prerequisites:**
- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)

```bash
# Clone the repo
git clone https://github.com/StuckInTheNet/ClipStash.git
cd ClipStash

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The production binary will be in `src-tauri/target/release/bundle/`.

## Development

```bash
# Start dev server with hot-reload
npm run tauri dev

# Type-check the frontend
npx tsc --noEmit

# Build the Rust backend only
cd src-tauri && cargo build
```

### Project structure

```
ClipStash/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks (useClips)
│   ├── styles/             # Tailwind CSS
│   ├── themes.ts           # 23 theme definitions
│   └── App.tsx             # Main app layout
├── src-tauri/              # Rust backend
│   └── src/
│       ├── clipboard.rs    # Clipboard monitoring (macOS/Windows)
│       ├── db.rs           # SQLite storage + folders
│       └── lib.rs          # Tauri commands
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://tauri.app/) |
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| Backend | Rust |
| Storage | SQLite (via rusqlite) |
| Clipboard | Native OS APIs (pbpaste/pbcopy, PowerShell) |

## Why Tauri?

A clipboard manager lives in the background 24/7, so resource efficiency matters. Tauri ships a ~5MB binary that uses ~30MB of RAM. Electron, by comparison, produces a ~150MB binary and consumes 150MB+ of memory at idle. For a utility that's always running, lightweight wins.

## License

[MIT](LICENSE)
