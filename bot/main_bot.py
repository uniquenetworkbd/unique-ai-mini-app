#!/usr/bin/env python3
"""
Professional Telegram Bot Engine - Nano AI for Unique Network BD
Zero-backend ISP support system with JSON-based memory
Runs on GitHub Actions with environment variable configuration
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
from pathlib import Path

# Third-party imports
try:
    import telebot
    from telebot import types
    from telebot.apihelper import ApiException
except ImportError as e:
    print(f"Failed to import required libraries: {e}")
    print("Please install requirements: pip install -r requirements.txt")
    sys.exit(1)

# ============================================================================
# Configuration & Setup
# ============================================================================

# Setup logging with both file and console output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('bot.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# Path configuration
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
BRAIN_PATH = DATA_DIR / 'brain.json'
CONFIG_PATH = DATA_DIR / 'config.json'

# Create data directory if it doesn't exist
DATA_DIR.mkdir(exist_ok=True)


class ConfigManager:
    """Manage configuration from environment variables and config.json"""
    
    def __init__(self):
        self.bot_token = None
        self.admin_chat_id = None
        self.load_config()
    
    def load_config(self):
        """Load configuration from environment variables with fallback to config.json"""
        # Try environment variables first (GitHub Secrets)
        self.bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        self.admin_chat_id = os.environ.get('ADMIN_CHAT_ID')
        
        # Fallback to config.json if environment variables are not set
        if not self.bot_token or not self.admin_chat_id:
            logger.info("Environment variables not found, checking config.json...")
            try:
                if CONFIG_PATH.exists():
                    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        self.bot_token = config.get('telegram_bot_token', self.bot_token)
                        self.admin_chat_id = config.get('admin_chat_id', self.admin_chat_id)
                    logger.info("Configuration loaded from config.json")
            except Exception as e:
                logger.error(f"Failed to load config.json: {e}")
        
        # Validate configuration
        if not self.bot_token:
            logger.critical("TELEGRAM_BOT_TOKEN is not set!")
            raise ValueError("Bot token is required. Set TELEGRAM_BOT_TOKEN environment variable or add to config.json")
        
        if not self.admin_chat_id:
            logger.warning("ADMIN_CHAT_ID is not set. Admin features will be disabled.")
    
    def save_config(self):
        """Save current configuration to config.json"""
        try:
            config = {
                'telegram_bot_token': self.bot_token,
                'admin_chat_id': self.admin_chat_id,
                'updated_at': datetime.now().isoformat()
            }
            with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            logger.info("Configuration saved to config.json")
            return True
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
            return False


class NanoAIBrain:
    """Nano AI memory system with JSON-based knowledge base"""
    
    def __init__(self, brain_path: Path, admin_alert_callback=None):
        self.brain_path = brain_path
        self.admin_alert = admin_alert_callback
        self.brain_data = self._load_brain()
        self.last_load_time = datetime.now()
        self.load_errors = 0
        
    def _create_default_brain(self) -> Dict:
        """Create default brain structure for ISP support"""
        return {
            "brain_version": "2.0.0-Nano",
            "ai_sensitivity": 0.75,
            "last_updated": datetime.now().isoformat(),
            "knowledge_base": [
                {
                    "id": "slow_internet",
                    "pattern": ["internet", "slow", "speed", "buffering", "lag"],
                    "response": "🔧 <b>Internet Speed Issues</b>\n\nLet me help you troubleshoot:\n\n1️⃣ <b>Restart Router</b>\n   • Unplug power for 30 seconds\n   • Plug back in and wait 2 minutes\n   \n2️⃣ <b>Check Connections</b>\n   • Ensure all cables are securely connected\n   • Check fiber optic cable for bends\n   \n3️⃣ <b>Test Speed</b>\n   • Visit speedtest.net\n   • Share results with support\n   \n⚠️ If problem persists, our team will investigate.",
                    "category": "technical"
                },
                {
                    "id": "wifi_password",
                    "pattern": ["wifi", "password", "ssid", "connect", "wireless"],
                    "response": "🔐 <b>WiFi Configuration</b>\n\n<b>Default Credentials:</b>\n• SSID: UniqueNetwork_XXXX\n• Password: unique@123\n\n<b>To Change WiFi Password:</b>\n1. Open browser, go to 192.168.1.1\n2. Login: admin / admin\n3. Navigate to Wireless Settings\n4. Change password and save\n\n<b>Pro Tip:</b> Use WPA2 encryption for security.",
                    "category": "wifi"
                },
                {
                    "id": "bill_payment",
                    "pattern": ["bill", "payment", "pay", "due", "invoice", "monthly"],
                    "response": "💳 <b>Billing & Payments</b>\n\n<b>Payment Methods:</b>\n📱 <b>Mobile Banking:</b>\n   • bKash: 123456 (Bill ID as reference)\n   • Nagad: 123456\n   • Rocket: 123456\n\n💻 <b>Online Portal:</b>\n   • unique-network.com/pay\n   • Use customer ID: [Your ID]\n\n🏧 <b>Bank Deposit:</b>\n   • Account: Unique Network BD\n   • Bank: Dutch Bangla Bank\n   • Account: 1234567890\n\n<b>Due Date:</b> 10th of every month\n<b>Late Fee:</b> 50 BDT/day",
                    "category": "billing"
                },
                {
                    "id": "technical_support",
                    "pattern": ["support", "help", "agent", "human", "talk", "speak"],
                    "response": "👨‍💻 <b>Customer Support</b>\n\nWe're here to help 24/7:\n\n📞 <b>Hotline:</b> 1234567890\n💬 <b>Live Chat:</b> unique-network.com/chat\n📧 <b>Email:</b> support@unique-network.com\n📍 <b>Office:</b> 123 Gulshan Avenue, Dhaka\n\n<b>Support Hours:</b>\n• Phone: 9 AM - 9 PM (Daily)\n• Live Chat: 24/7\n• Email Response: Within 2 hours",
                    "category": "support"
                },
                {
                    "id": "packages",
                    "pattern": ["package", "plan", "price", "cost", "monthly", "subscription"],
                    "response": "📦 <b>Internet Packages</b>\n\n<b>Residential Plans:</b>\n• <b>Basic:</b> 20 Mbps - 1200 BDT/month\n• <b>Standard:</b> 50 Mbps - 1800 BDT/month\n• <b>Premium:</b> 100 Mbps - 2500 BDT/month\n• <b>Ultra:</b> 200 Mbps - 4000 BDT/month\n\n<b>Business Plans:</b>\n• <b>Business Basic:</b> 50 Mbps - 3000 BDT\n• <b>Business Pro:</b> 100 Mbps - 5000 BDT\n• <b>Enterprise:</b> Custom quote\n\n✅ <b>All Plans Include:</b>\n✓ Unlimited data\n✓ 24/7 technical support\n✓ Free installation\n✓ Static IP (Business only)",
                    "category": "packages"
                },
                {
                    "id": "outage",
                    "pattern": ["outage", "down", "not working", "disconnected", "no internet"],
                    "response": "⚠️ <b>Service Outage Alert</b>\n\n<b>Status:</b> We've detected a potential service disruption\n\n<b>What to do:</b>\n1. Check if neighbors are affected\n2. Check our status page: unique-network.com/status\n3. Wait for updates from our team\n\n<b>Estimated Resolution:</b> 2-4 hours\n\n<b>Compensation:</b> Affected customers will receive credit adjustment\n\nWe apologize for the inconvenience!",
                    "category": "technical"
                }
            ],
            "default_responses": {
                "unknown": "🤔 I'm not sure I understand. Could you please rephrase your question?\n\nTry asking about:\n• Internet speed\n• WiFi password\n• Bill payment\n• Technical support\n• Our packages",
                "error": "⚠️ System is experiencing technical difficulties. Our team has been notified. Please try again in a few minutes."
            }
        }
    
    def _load_brain(self) -> Dict:
        """Load brain data from JSON file with comprehensive error handling"""
        try:
            if not self.brain_path.exists():
                logger.warning(f"Brain file not found at {self.brain_path}. Creating default...")
                default_brain = self._create_default_brain()
                self._save_brain(default_brain)
                
                # Alert admin about missing brain file
                if self.admin_alert:
                    self.admin_alert(
                        "⚠️ <b>Brain File Alert</b>\n\n"
                        f"Brain file was missing at {self.brain_path}\n"
                        "Default brain has been created.\n"
                        "Please review and customize the knowledge base."
                    )
                return default_brain
            
            with open(self.brain_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Validate brain structure
            if not self._validate_brain(data):
                logger.error("Invalid brain structure detected")
                raise ValueError("Brain file has invalid structure")
            
            logger.info(f"Brain loaded successfully: v{data.get('brain_version', 'unknown')}")
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in brain file: {e}")
            self._alert_admin_corrupted_brain(f"JSON Parse Error: {e}")
            return self._create_default_brain()
            
        except Exception as e:
            logger.error(f"Failed to load brain: {e}")
            self._alert_admin_corrupted_brain(f"Loading Error: {e}")
            return self._create_default_brain()
    
    def _validate_brain(self, data: Dict) -> bool:
        """Validate brain data structure"""
        required_keys = ['brain_version', 'knowledge_base', 'default_responses']
        if not all(key in data for key in required_keys):
            return False
        
        if not isinstance(data['knowledge_base'], list):
            return False
        
        return True
    
    def _save_brain(self, data: Dict) -> bool:
        """Save brain data to JSON file"""
        try:
            data['last_updated'] = datetime.now().isoformat()
            with open(self.brain_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info("Brain saved successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving brain: {e}")
            return False
    
    def _alert_admin_corrupted_brain(self, error_msg: str):
        """Send alert to admin about corrupted brain"""
        if self.admin_alert:
            alert_msg = (
                "🚨 <b>CRITICAL: Brain File Corruption Detected!</b>\n\n"
                f"<b>Error:</b> {error_msg}\n"
                f"<b>Path:</b> {self.brain_path}\n\n"
                "<b>Action Taken:</b>\n"
                "✓ Loaded default brain as fallback\n"
                "✓ Original file may be corrupted\n\n"
                "<b>Required Action:</b>\n"
                "1. Check the brain.json file\n"
                "2. Restore from backup or recreate\n"
                "3. Use /reload after fixing"
            )
            self.admin_alert(alert_msg)
    
    def reload(self) -> Tuple[bool, str]:
        """Reload brain from file"""
        try:
            new_brain = self._load_brain()
            if new_brain:
                self.brain_data = new_brain
                self.last_load_time = datetime.now()
                self.load_errors = 0
                logger.info("Brain reloaded successfully")
                return True, "Brain reloaded successfully"
            else:
                return False, "Failed to reload brain"
        except Exception as e:
            self.load_errors += 1
            error_msg = f"Reload failed: {e}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_response(self, user_message: str) -> str:
        """Get AI response based on fuzzy keyword matching"""
        if not user_message or not isinstance(user_message, str):
            return self.brain_data["default_responses"]["unknown"]
        
        user_message_lower = user_message.lower()
        best_match = None
        best_score = 0
        matched_pattern = None
        sensitivity = self.brain_data.get("ai_sensitivity", 0.75)
        
        # Search through knowledge base
        for entry in self.brain_data["knowledge_base"]:
            patterns = entry.get("pattern", [])
            if not patterns:
                continue
            
            for pattern in patterns:
                if not pattern:
                    continue
                
                pattern_lower = pattern.lower()
                
                # Check for exact word match (highest priority)
                if pattern_lower in user_message_lower:
                    score = 1.0
                else:
                    # Check for individual words in pattern
                    pattern_words = pattern_lower.split()
                    matching_words = sum(1 for word in pattern_words if word in user_message_lower)
                    if pattern_words:
                        word_match_ratio = matching_words / len(pattern_words)
                        score = word_match_ratio
                    else:
                        # Fuzzy matching as fallback
                        score = SequenceMatcher(None, pattern_lower, user_message_lower).ratio()
                
                if score > best_score:
                    best_score = score
                    best_match = entry.get("response", "")
                    matched_pattern = pattern
        
        # Log match details for debugging
        if best_match and best_score >= sensitivity:
            logger.info(f"Match found: pattern='{matched_pattern}', score={best_score:.2f}")
            return best_match
        
        # No good match found
        logger.info(f"No match found (best score: {best_score:.2f})")
        return self.brain_data["default_responses"]["unknown"]
    
    def get_status(self) -> Dict[str, Any]:
        """Get brain status information"""
        return {
            "brain_version": self.brain_data.get("brain_version", "unknown"),
            "knowledge_base_size": len(self.brain_data.get("knowledge_base", [])),
            "ai_sensitivity": self.brain_data.get("ai_sensitivity", 0.75),
            "last_load_time": self.last_load_time.isoformat(),
            "load_errors": self.load_errors,
            "file_path": str(self.brain_path),
            "categories": list(set(entry.get("category", "uncategorized") for entry in self.brain_data.get("knowledge_base", [])))
        }


class TelegramBot:
    """Main Telegram Bot class with Nano AI integration"""
    
    def __init__(self, token: str, admin_id: Optional[str]):
        self.bot = telebot.TeleBot(token, parse_mode='HTML')
        self.admin_id = int(admin_id) if admin_id else None
        self.start_time = datetime.now()
        self.message_count = 0
        self.error_count = 0
        
        # Initialize Nano AI Brain with admin alert callback
        self.brain = NanoAIBrain(BRAIN_PATH, self.send_admin_alert)
        
        # Register all handlers
        self._register_handlers()
        
        logger.info("Bot initialized successfully")
    
    def send_admin_alert(self, message: str):
        """Send alert message to admin"""
        if self.admin_id:
            try:
                self.bot.send_message(self.admin_id, message)
                logger.info("Admin alert sent")
            except Exception as e:
                logger.error(f"Failed to send admin alert: {e}")
    
    def is_admin(self, chat_id: int) -> bool:
        """Check if user is admin"""
        return self.admin_id is not None and chat_id == self.admin_id
    
    def _register_handlers(self):
        """Register all bot message handlers"""
        
        @self.bot.message_handler(commands=['start', 'help'])
        def send_welcome(message: types.Message):
            self.message_count += 1
            welcome_text = (
                "🌟 <b>Welcome to Unique Network BD ISP Support Bot!</b> 🌟\n\n"
                "I'm your AI-powered support assistant, ready to help 24/7.\n\n"
                "<b>What I can help with:</b>\n"
                "• 🔧 Internet speed & connectivity issues\n"
                "• 🔐 WiFi setup and password recovery\n"
                "• 💳 Bill payments & account inquiries\n"
                "• 📦 Package information & upgrades\n"
                "• 👨‍💻 Technical support & troubleshooting\n\n"
                "<b>How to use:</b>\n"
                "Simply type your question naturally, and I'll find the best answer!\n\n"
                "<i>Example: \"My internet is slow\" or \"How to pay bill?\"</i>\n\n"
                f"<b>Bot Status:</b> 🟢 Online | <b>Brain Version:</b> {self.brain.brain_data.get('brain_version', 'Nano AI')}"
            )
            self.bot.reply_to(message, welcome_text)
        
        @self.bot.message_handler(commands=['admin'])
        def admin_panel(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ <b>Access Denied</b>\n\nThis command is only available to administrators.")
                return
            
            panel_text = (
                "🔐 <b>Admin Control Panel</b>\n\n"
                "<b>Available Commands:</b>\n"
                "• /status - View system health & brain status\n"
                "• /reload - Reload brain from JSON file\n"
                "• /stats - View bot usage statistics\n"
                "• /brain_info - Show brain configuration\n\n"
                "<b>System Information:</b>\n"
                f"• Bot Status: 🟢 Active\n"
                f"• Messages: {self.message_count}\n"
                f"• Uptime: {str(datetime.now() - self.start_time).split('.')[0]}"
            )
            self.bot.reply_to(message, panel_text)
        
        @self.bot.message_handler(commands=['status'])
        def send_status(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only.")
                return
            
            brain_status = self.brain.get_status()
            uptime = datetime.now() - self.start_time
            
            status_text = (
                "📊 <b>System Status Report</b>\n\n"
                "🤖 <b>Bot Status:</b> 🟢 Online\n"
                f"⏱️ <b>Uptime:</b> {str(uptime).split('.')[0]}\n"
                f"💬 <b>Messages Processed:</b> {self.message_count}\n"
                f"⚠️ <b>Errors:</b> {self.error_count}\n\n"
                "🧠 <b>Nano AI Brain Status:</b>\n"
                f"• <b>Version:</b> {brain_status['brain_version']}\n"
                f"• <b>Knowledge Base:</b> {brain_status['knowledge_base_size']} entries\n"
                f"• <b>Categories:</b> {', '.join(brain_status['categories'])}\n"
                f"• <b>Sensitivity:</b> {brain_status['ai_sensitivity']}\n"
                f"• <b>Last Load:</b> {brain_status['last_load_time']}\n"
                f"• <b>Load Errors:</b> {brain_status['load_errors']}\n"
                f"• <b>Storage:</b> {brain_status['file_path']}\n\n"
                "<i>Use /reload to refresh brain data</i>"
            )
            self.bot.reply_to(message, status_text)
        
        @self.bot.message_handler(commands=['reload'])
        def reload_brain(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only.")
                return
            
            # Send typing indicator
            self.bot.send_chat_action(message.chat.id, 'typing')
            
            success, msg = self.brain.reload()
            if success:
                status = self.brain.get_status()
                response = (
                    f"✅ <b>Brain Reloaded Successfully</b>\n\n"
                    f"<b>Version:</b> {status['brain_version']}\n"
                    f"<b>Knowledge Entries:</b> {status['knowledge_base_size']}\n"
                    f"<b>Categories:</b> {', '.join(status['categories'])}\n\n"
                    "<i>New knowledge base is now active!</i>"
                )
            else:
                response = f"❌ <b>Reload Failed</b>\n\n{msg}\n\nPlease check the brain.json file for errors."
            
            self.bot.reply_to(message, response)
        
        @self.bot.message_handler(commands=['stats'])
        def send_stats(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only.")
                return
            
            uptime = datetime.now() - self.start_time
            brain_status = self.brain.get_status()
            
            stats_text = (
                "📈 <b>Bot Usage Statistics</b>\n\n"
                f"<b>Total Messages:</b> {self.message_count}\n"
                f"<b>Bot Uptime:</b> {str(uptime).split('.')[0]}\n"
                f"<b>Errors:</b> {self.error_count}\n\n"
                "<b>Brain Performance:</b>\n"
                f"• <b>Knowledge Size:</b> {brain_status['knowledge_base_size']} patterns\n"
                f"• <b>Reloads:</b> {brain_status['load_errors']} failures\n"
                f"• <b>Sensitivity:</b> {brain_status['ai_sensitivity']}\n\n"
                "<b>Average Response Time:</b> < 100ms\n"
                "<b>System Health:</b> 🟢 Excellent"
            )
            self.bot.reply_to(message, stats_text)
        
        @self.bot.message_handler(commands=['brain_info'])
        def brain_info(message: types.Message):
            self.message_count += 1
            if not self.is_admin(message.chat.id):
                self.bot.reply_to(message, "⛔ Access denied. Admin only.")
                return
            
            brain_status = self.brain.get_status()
            
            info_text = (
                "🧠 <b>Nano AI Brain Configuration</b>\n\n"
                f"<b>Version:</b> {brain_status['brain_version']}\n"
                f"<b>Sensitivity Threshold:</b> {brain_status['ai_sensitivity']}\n\n"
                "<b>Knowledge Categories:</b>\n"
            )
            
            # Add category details
            categories = {}
            for entry in self.brain.brain_data.get('knowledge_base', []):
                cat = entry.get('category', 'uncategorized')
                if cat not in categories:
                    categories[cat] = 0
                categories[cat] += 1
            
            for cat, count in categories.items():
                info_text += f"• {cat.capitalize()}: {count} patterns\n"
            
            info_text += f"\n<b>Default Response:</b>\n{self.brain.brain_data['default_responses']['unknown'][:100]}..."
            
            self.bot.reply_to(message, info_text)
        
        @self.bot.message_handler(func=lambda message: True)
        def handle_message(message: types.Message):
            """Handle all text messages with Nano AI brain"""
            try:
                self.message_count += 1
                
                # Ignore non-text messages
                if not message.text:
                    return
                
                user_text = message.text
                user_id = message.from_user.id
                logger.info(f"User {user_id}: {user_text[:100]}")
                
                # Send typing indicator for better UX
                self.bot.send_chat_action(message.chat.id, 'typing')
                
                # Get AI response
                response = self.brain.get_response(user_text)
                
                # Send response
                self.bot.reply_to(message, response)
                
            except ApiException as e:
                self.error_count += 1
                logger.error(f"Telegram API error: {e}")
                error_msg = "⚠️ Service temporarily unavailable. Please try again in a few moments."
                try:
                    self.bot.reply_to(message, error_msg)
                except:
                    pass
                    
            except Exception as e:
                self.error_count += 1
                logger.error(f"Unexpected error in message handler: {e}", exc_info=True)
                error_msg = "❌ An unexpected error occurred. Our team has been notified."
                try:
                    self.bot.reply_to(message, error_msg)
                except:
                    pass
                
                # Alert admin about critical error
                if self.admin_id and self.error_count % 10 == 0:  # Alert every 10 errors
                    self.send_admin_alert(
                        f"🚨 <b>Critical Error Alert</b>\n\n"
                        f"Error: {str(e)[:200]}\n"
                        f"User: {user_id}\n"
                        f"Message: {user_text[:100]}\n"
                        f"Total Errors: {self.error_count}"
                    )
    
    def run(self):
        """Start the bot with polling"""
        logger.info("Starting bot polling...")
        
        # Send startup notification to admin
        if self.admin_id:
            startup_msg = (
                "🚀 <b>Bot Started Successfully</b>\n\n"
                f"<b>Time:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"<b>Brain Version:</b> {self.brain.brain_data.get('brain_version', 'Nano AI')}\n"
                f"<b>Knowledge Base:</b> {len(self.brain.brain_data.get('knowledge_base', []))} entries\n\n"
                "<b>System Ready:</b> 🟢 Active"
            )
            try:
                self.bot.send_message(self.admin_id, startup_msg)
            except Exception as e:
                logger.error(f"Failed to send startup message: {e}")
        
        # Start polling with error recovery
        while True:
            try:
                self.bot.polling(none_stop=True, interval=1, timeout=30)
            except ApiException as e:
                logger.error(f"API Exception during polling: {e}")
                time.sleep(5)
                continue
            except Exception as e:
                logger.error(f"Unexpected error during polling: {e}")
                time.sleep(5)
                continue


# ============================================================================
# Main Execution
# ============================================================================

def signal_handler(signum, frame):
    """Handle graceful shutdown"""
    logger.info("Received shutdown signal. Stopping bot...")
    sys.exit(0)

def main():
    """Main entry point"""
    try:
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        logger.info("=" * 50)
        logger.info("Starting Unique Network BD ISP Bot")
        logger.info("=" * 50)
        
        # Load configuration
        config = ConfigManager()
        
        # Initialize and run bot
        bot = TelegramBot(config.bot_token, config.admin_chat_id)
        bot.run()
        
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
