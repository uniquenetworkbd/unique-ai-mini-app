#!/usr/bin/env python3
"""
Professional Telegram Bot Engine (Nano AI) for Unique Network BD
Zero-backend solution running on GitHub Actions with JSON-based memory
"""

import os
import sys
import json
import time
import logging
import signal
import functools
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from difflib import SequenceMatcher
import telebot
from telebot import types
from telebot.apihelper import ApiException

# ============================================================================
# Configuration & Setup
# ============================================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('bot.log')
    ]
)
logger = logging.getLogger(__name__)

# Environment variables
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
ADMIN_CHAT_ID = os.environ.get('ADMIN_CHAT_ID')
DATA_PATH = os.environ.get('DATA_PATH', 'data/brain.json')

# Validate critical environment variables
if not BOT_TOKEN:
    logger.critical("TELEGRAM_BOT_TOKEN environment variable not set!")
    sys.exit(1)

# Initialize bot
try:
    bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')
    logger.info("Bot initialized successfully")
except Exception as e:
    logger.critical(f"Failed to initialize bot: {e}")
    sys.exit(1)


# ============================================================================
# Nano AI Brain - Memory Management
# ============================================================================

class NanoAIBrain:
    """Nano AI memory system with JSON-based storage and fuzzy matching"""
    
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.brain_data = self._load_brain()
        self.last_load_time = datetime.now()
        
    def _load_brain(self) -> Dict:
        """Load brain data from JSON file with error handling"""
        try:
            # Create data directory if it doesn't exist
            os.makedirs(os.path.dirname(self.data_path), exist_ok=True)
            
            # Load existing brain or create default
            if os.path.exists(self.data_path):
                with open(self.data_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"Brain loaded successfully: v{data.get('brain_version', 'unknown')}")
                    return data
            else:
                # Create default brain structure
                default_brain = {
                    "brain_version": "1.0.0-Nano",
                    "ai_sensitivity": 0.8,
                    "knowledge_base": [
                        {
                            "pattern": ["internet", "slow", "speed"],
                            "response": "🔧 To fix slow internet speed:\n1️⃣ Restart your router\n2️⃣ Check cable connections\n3️⃣ Run speed test at speedtest.net\nIf problem persists, contact support."
                        },
                        {
                            "pattern": ["password", "wifi", "ssid"],
                            "response": "🔐 Your WiFi credentials are printed on the back of your router.\nDefault: SSID: UniqueNetwork_XXXX, Password: unique@123"
                        },
                        {
                            "pattern": ["bill", "payment", "due"],
                            "response": "💳 To check your bill:\n1. Visit unique-network.com/pay\n2. Send 'BILL' to 12345\n3. Call our payment helpline: 1234567890"
                        },
                        {
                            "pattern": ["support", "help", "agent"],
                            "response": "👨‍💻 Need human support?\n📞 Call: 1234567890\n💬 Live chat: unique-network.com/support\n📧 Email: support@unique-network.com"
                        },
                        {
                            "pattern": ["outage", "down", "not working"],
                            "response": "⚠️ Service outage detected. Our team is working on it.\n📢 Check status: unique-network.com/status\n🕐 Estimated fix time: 2-4 hours"
                        }
                    ],
                    "default_responses": {
                        "unknown": "🤔 I'm not sure about that. Please contact our support team at 1234567890 for assistance."
                    }
                }
                self._save_brain(default_brain)
                logger.info("Default brain created successfully")
                return default_brain
                
        except Exception as e:
            logger.error(f"Error loading brain: {e}")
            # Return fallback brain
            return {
                "brain_version": "1.0.0-Nano",
                "ai_sensitivity": 0.8,
                "knowledge_base": [],
                "default_responses": {
                    "unknown": "Sorry, I'm having technical difficulties. Please contact support."
                }
            }
    
    def _save_brain(self, data: Dict) -> bool:
        """Save brain data to JSON file"""
        try:
            with open(self.data_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info("Brain saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving brain: {e}")
            return False
    
    def reload(self) -> bool:
        """Reload brain from file"""
        try:
            self.brain_data = self._load_brain()
            self.last_load_time = datetime.now()
            logger.info("Brain reloaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error reloading brain: {e}")
            return False
    
    def get_response(self, user_message: str) -> str:
        """Get AI response based on fuzzy keyword matching"""
        if not user_message:
            return self.brain_data["default_responses"]["unknown"]
        
        user_message_lower = user_message.lower()
        best_match = None
        best_score = 0
        sensitivity = self.brain_data.get("ai_sensitivity", 0.8)
        
        # Search through knowledge base
        for entry in self.brain_data["knowledge_base"]:
            patterns = entry.get("pattern", [])
            for pattern in patterns:
                if not pattern:
                    continue
                
                pattern_lower = pattern.lower()
                
                # Check for exact word match in message
                if pattern_lower in user_message_lower:
                    score = 1.0  # Perfect match
                else:
                    # Fuzzy matching for partial matches
                    score = SequenceMatcher(None, pattern_lower, user_message_lower).ratio()
                
                if score > best_score:
                    best_score = score
                    best_match = entry.get("response", "")
        
        # Return response if match quality meets sensitivity threshold
        if best_match and best_score >= sensitivity:
            logger.info(f"Match found: score={best_score:.2f}")
            return best_match
        
        # No good match found
        logger.info(f"No match found (best score: {best_score:.2f})")
        return self.brain_data["default_responses"]["unknown"]
    
    def get_status(self) -> Dict[str, Any]:
        """Get brain status information"""
        return {
            "brain_version": self.brain_data.get("brain_version", "unknown"),
            "knowledge_base_size": len(self.brain_data.get("knowledge_base", [])),
            "ai_sensitivity": self.brain_data.get("ai_sensitivity", 0.8),
            "last_load_time": self.last_load_time.isoformat(),
            "file_path": self.data_path
        }


# ============================================================================
# Bot Command Handlers
# ============================================================================

class BotHandlers:
    """Centralized bot command handlers"""
    
    def __init__(self, bot_instance, brain_instance, admin_id: Optional[str]):
        self.bot = bot_instance
        self.brain = brain_instance
        self.admin_id = admin_id
        self.start_time = datetime.now()
        self.message_count = 0
        
    def is_admin(self, chat_id: int) -> bool:
        """Check if user is admin"""
        if not self.admin_id:
            return False
        return str(chat_id) == self.admin_id
    
    def register_handlers(self):
        """Register all bot handlers"""
        
        @self.bot.message_handler(commands=['start', 'help'])
        def send_welcome(message: types.Message):
            self.message_count += 1
            welcome_text = (
                "🌟 <b>Welcome to Unique Network BD ISP Support Bot!</b> 🌟\n\n"
                "I'm your AI-powered support assistant. I can help you with:\n"
                "• Internet connection issues\n"
                "• WiFi setup and passwords\n"
                "• Bill payments and inquiries\n"
                "• Technical support\n\n"
                "<b>How to use:</b>\n"
                "Just type your question naturally, and I'll do my best to help!\n\n"
                "<i>Powered by Nano AI Brain v1.0</i>"
            )
            self.bot.reply_to(message, welcome_text)
        
        @self.bot.message_handler(commands=['status'])
        def send_status(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only command.")
                return
            
            # Get bot status
            uptime = datetime.now() - self.start_time
            brain_status = self.brain.get_status()
            
            status_text = (
                f"📊 <b>Bot Status Report</b>\n\n"
                f"🤖 <b>Bot:</b> Running\n"
                f"⏱️ <b>Uptime:</b> {str(uptime).split('.')[0]}\n"
                f"💬 <b>Messages Processed:</b> {self.message_count}\n"
                f"🧠 <b>Brain Version:</b> {brain_status['brain_version']}\n"
                f"📚 <b>Knowledge Size:</b> {brain_status['knowledge_base_size']} entries\n"
                f"🎯 <b>AI Sensitivity:</b> {brain_status['ai_sensitivity']}\n"
                f"🕐 <b>Brain Loaded:</b> {brain_status['last_load_time']}\n"
                f"💾 <b>Storage:</b> {brain_status['file_path']}"
            )
            self.bot.reply_to(message, status_text)
        
        @self.bot.message_handler(commands=['reload'])
        def reload_brain(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only command.")
                return
            
            if self.brain.reload():
                status = self.brain.get_status()
                self.bot.reply_to(
                    message,
                    f"✅ Brain reloaded successfully!\n\n"
                    f"Version: {status['brain_version']}\n"
                    f"Knowledge entries: {status['knowledge_base_size']}"
                )
            else:
                self.bot.reply_to(message, "❌ Failed to reload brain. Check logs.")
        
        @self.bot.message_handler(commands=['stats'])
        def send_stats(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only command.")
                return
            
            stats_text = (
                f"📈 <b>Usage Statistics</b>\n\n"
                f"Total messages: {self.message_count}\n"
                f"Uptime: {str(datetime.now() - self.start_time).split('.')[0]}"
            )
            self.bot.reply_to(message, stats_text)
        
        @self.bot.message_handler(func=lambda message: True)
        def handle_message(message: types.Message):
            """Handle all text messages with AI brain"""
            try:
                self.message_count += 1
                user_text = message.text
                logger.info(f"User {message.chat.id}: {user_text}")
                
                # Get AI response
                response = self.brain.get_response(user_text)
                
                # Send response with typing indicator
                self.bot.send_chat_action(message.chat.id, 'typing')
                time.sleep(0.5)  # Natural typing delay
                self.bot.reply_to(message, response)
                
            except ApiException as e:
                logger.error(f"Telegram API error: {e}")
                self.bot.reply_to(message, "⚠️ Service temporarily unavailable. Please try again.")
            except Exception as e:
                logger.error(f"Unexpected error in message handler: {e}")
                self.bot.reply_to(message, "❌ An error occurred. Our team has been notified.")
        
        logger.info("All handlers registered successfully")


# ============================================================================
# Main Execution
# ============================================================================

def signal_handler(signum, frame):
    """Handle graceful shutdown"""
    logger.info("Received shutdown signal. Stopping bot...")
    sys.exit(0)

def main():
    """Main bot execution function"""
    try:
        # Setup signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        logger.info("Starting Unique Network BD ISP Bot...")
        
        # Initialize Nano AI Brain
        brain = NanoAIBrain(DATA_PATH)
        logger.info("Nano AI Brain initialized")
        
        # Initialize bot handlers
        handlers = BotHandlers(bot, brain, ADMIN_CHAT_ID)
        handlers.register_handlers()
        
        logger.info("Bot is ready to handle messages")
        
        # Start polling with error handling
        while True:
            try:
                bot.polling(none_stop=True, interval=1, timeout=30)
            except ApiException as e:
                logger.error(f"API Exception during polling: {e}")
                time.sleep(5)
                continue
            except Exception as e:
                logger.error(f"Unexpected error during polling: {e}")
                time.sleep(5)
                continue
                
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
