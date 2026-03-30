Project Structure

unique-nano-ai/
├── .github/
│   └── workflows/
│       └── bot_runner.yml
├── admin/
│   ├── dashboard.html
│   └── login.html
├── bot/
│   └── main_bot.py
├── data/
│   ├── brain.json
│   └── users.json
├── js/
│   ├── github-api.js
│   ├── system-health.js
│   └── dashboard.js
└── README.md
# Unique Network BD ISP Bot

Zero-backend Telegram bot with Nano AI brain for ISP customer support.

## Features
- 🤖 Fully automated Telegram bot
- 🧠 JSON-based "Nano AI" memory system
- 🔍 Fuzzy keyword matching for intelligent responses
- 👑 Admin commands (/status, /reload, /stats)
- ☁️ Runs on GitHub Actions (free hosting)
- 📊 Automatic logging and monitoring

## Setup

### 1. Create Telegram Bot
1. Message @BotFather on Telegram
2. Send `/newbot` and follow instructions
3. Save the bot token

### 2. Get Your Chat ID (for admin)
1. Message your bot
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Copy your chat ID from response

### 3. GitHub Setup
1. Fork/clone this repository
2. Add secrets in GitHub:
   - `TELEGRAM_BOT_TOKEN`: Your bot token
   - `ADMIN_CHAT_ID`: Your chat ID
3. Push to main branch

### 4. Customize Brain
Edit `data/brain.json` to add custom responses:
- Pattern: Keywords to trigger response
- Response: Bot's reply (supports HTML)
- Sensitivity: 0.0-1.0 match threshold

## Admin Commands
- `/status` - Bot status and brain info
- `/reload` - Reload brain from JSON
- `/stats` - Usage statistics

## How It Works
1. Bot runs via GitHub Actions every 5 minutes
2. Reads from `data/brain.json` for knowledge
3. Uses fuzzy matching to find best response
4. Returns AI response or default message

## Maintenance
- Brain updates: Edit JSON and push
- Logs: Available in GitHub Actions artifacts
- Uptime: 24/7 with auto-restart

## License
MIT
