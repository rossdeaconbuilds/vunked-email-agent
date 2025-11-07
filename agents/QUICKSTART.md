# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
cd agents
npm install
```

### 2. Set Your OpenAI API Key

**If you already have `OPEN_API_KEY_CURSOR` in your environment:**
```bash
# Skip this step - the tool will automatically use OPEN_API_KEY_CURSOR
```

**Otherwise, create a `.env` file:**
```bash
echo "OPENAI_API_KEY=sk-your-key-here" > .env
```

### 3. Generate Your First Email
```bash
# From a blog URL
node index.js --url "https://vunked.com/blog/your-post"

# Or from a prompt
node index.js --prompt "Create a Black Friday email with 20% off"

# Or from text
node index.js --text "Your blog content here..."
```

## 📂 What Gets Generated

Each run creates two files in `../output/`:
- `{slug}-{timestamp}.html` - Ready for Klaviyo
- `{slug}-{timestamp}.txt` - Plain text version

## 🎨 How It Works

```
INPUT (URL/Text/Prompt)
  ↓
RETRIEVE → Clean blog content
  ↓
PLAN → AI creates email structure (o3-mini)
  ↓
WRITE → AI fills sections with content (gpt-5-mini)
  ↓
OUTPUT → HTML + Text files
```

## 🔧 Common Use Cases

### Blog Post to Email
```bash
node index.js --url "https://vunked.com/blog/battery-guide"
```

### Campaign Email from Scratch
```bash
node index.js --prompt "Black Friday sale: 20% off all electrical kits, mention free shipping over £500"
```

### Custom Sections Path
```bash
node index.js --prompt "..." --sections ../sections --out ../campaigns
```

## ⚙️ Configuration

Edit `.env` to change defaults:
```bash
OPENAI_API_KEY=sk-...
MODEL_PLAN=o3-mini-2025-01-31  # Model for planning
MODEL_WRITE=gpt-5-mini         # Model for content generation
```

Or override via CLI:
```bash
node index.js --prompt "..." --modelPlan gpt-4o --modelWrite gpt-4o-mini
```

## 🐛 Troubleshooting

**"Model not found"**
- If `o3-mini-2025-01-31` or `gpt-5-mini` are not available
- System auto-falls back to `gpt-4o-mini`
- Specify working models: `--modelPlan gpt-4o-mini --modelWrite gpt-4o-mini`

**"OPEN_API_KEY_CURSOR or OPENAI_API_KEY not set"**
- If using global variables, ensure `OPEN_API_KEY_CURSOR` is exported in your shell
- OR create `.env` file in `agents/` directory with `OPENAI_API_KEY=sk-...`

**"Failed to fetch content"**
- Check URL is publicly accessible
- Some sites block scrapers - use `--text` instead

## 📖 Full Documentation

See [README.md](./README.md) for complete documentation.

