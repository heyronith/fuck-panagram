# Fuck panagram

A modern AI text humanizer studio that transforms raw AI-generated text into undetectable, natural human writing using the **StealthGPT API**.

![StealthGPT Humanizer](static/favicon.svg)

---

## ✨ Features

- **Side-by-Side Dual Studio**: Compare your original AI text with the humanized result in real-time.
- **Visual Diff Viewer**: Interactive word-level difference highlighting (additions in green, removals in red strikethrough).
- **Multiple AI Models**:
  - `super` (Recommended): Maximum undetectable score against Turnitin, GPTZero, Winston AI, and Originality.
  - `standard`: Fast, balanced humanization for general content.
  - `lite`: Rapid lightweight rewriting.
- **Tone & Writing Mode Controls**:
  - Tones: *Standard, Casual, Professional, College, PhD, High School*.
  - Modes: *Default, Academic / Essay*.
- **Live Statistics**: Real-time word count, character count, and length variance percentage.
- **Quick Sample Prompts**: 1-click loading of realistic AI test samples (Academic, Business, Renewable Energy).
- **One-Click Export**: Copy to clipboard with instant confirmation, or download as `.txt` or `.md`.
- **Generation History**: Persists past humanized texts locally in `history.json` with 1-click reload and clear options.
- **Secure Key Management**: Set your key via `.env` file or directly in the UI Settings modal with a built-in connection tester.
- **CLI Utility**: Command-line interface for humanizing text or files directly in your terminal.

---

## 🚀 Quick Start

### 1. Launch the Local Web App

Run the launcher script:
```bash
./run.sh
```

Or run directly with Python:
```bash
source .venv/bin/activate
python app.py
```

The app will start at **`http://127.0.0.1:8000`** and open in your default browser automatically.

---

### 2. Configure Your API Key

You can configure your StealthGPT API key in either of two ways:

1. **In the Web UI**: Click the **Settings** button in the header or the banner, paste your API key, and click **Save Key**.
2. **In `.env`**: Edit `/Users/ronny/Desktop/stealthgpt/.env`:
   ```env
   STEALTHGPT_API_KEY=your_stealthgpt_api_key_here
   ```

---

### 3. Using the CLI Tool

You can also humanize text and files directly from your terminal:

```bash
# Direct text
./cli.py "Furthermore, it is important to note that artificial intelligence..."

# Specify model and tone
./cli.py "Your AI draft text" -m super -t College -w essay

# From an input file and save to output file
./cli.py -f input.txt -o output.txt
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>⌘ + Enter</kbd> (Mac) / <kbd>Ctrl + Enter</kbd> | Humanize current text |
| <kbd>Esc</kbd> | Close Settings modal / History drawer |

---

## 🛠 Project Structure

```
stealthgpt/
├── app.py                # FastAPI web server and API endpoints
├── stealth_client.py     # StealthGPT API client wrapper
├── history_manager.py    # Local JSON generation history store
├── cli.py                # Standalone command-line tool
├── run.sh                # Automatic venv & app launcher
├── requirements.txt      # Python dependencies
├── .env                  # Local API key & server configuration
├── static/
│   ├── css/style.css     # Dark glassmorphic design system
│   ├── js/app.js         # Frontend controller and diff engine
│   └── favicon.svg       # Custom app icon
└── templates/
    └── index.html        # Web app interface

---

## 🌐 Deploy to Vercel (Recommended)

**Fuck panagram** is fully configured for **Vercel** serverless deployment with [vercel.json](file:///Users/ronny/Desktop/stealthgpt/vercel.json) and [api/index.py](file:///Users/ronny/Desktop/stealthgpt/api/index.py).

### Method 1: Deploy from GitHub (Easiest)

1. Push this project to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Deploy Fuck panagram to Vercel"
   git branch -M main
   git remote add origin https://github.com/<your-username>/fuck-panagram.git
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com) and click **"Add New..."** $\rightarrow$ **"Project"**.
3. Import your `fuck-panagram` repository.
4. Under **Environment Variables**, add:
   - **Key**: `STEALTHGPT_API_KEY`
   - **Value**: *your_stealthgpt_api_key*
5. Click **Deploy**. Vercel will build and assign you a fast, global HTTPS domain (e.g., `https://fuck-panagram.vercel.app`)!

---

### Method 2: Deploy via Vercel CLI (Instant from Terminal)

If you have `vercel` installed locally:
```bash
npx vercel
```
- Link to your existing Vercel account.
- Add your environment variable when prompted or via dashboard.
- Done!

---

## ☁️ Alternative Cloud Options (Render / Railway)

If you prefer Render or Railway, the repository also includes [render.yaml](file:///Users/ronny/Desktop/stealthgpt/render.yaml) and [Procfile](file:///Users/ronny/Desktop/stealthgpt/Procfile) for 1-click deploys.

