const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Get bot token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const API_BASE = 'https://acp.venkatr.cloud';

// Shipping address (demo)
const DEMO_ADDRESS = {
  name: 'Demo User',
  line_one: '100 Main Street',
  city: 'Cincinnati',
  state: 'OH',
  country: 'US',
  postal_code: '40000',
};

// Product catalog (same as server)
const products = {
  item_123: { id: 'item_123', name: 'Premium T-Shirt', emoji: '👕' },
  item_456: { id: 'item_456', name: 'Classic Hat', emoji: '🧢' },
  item_789: { id: 'item_789', name: 'Vintage Hoodie', emoji: '🪡' },
};

// Store user alerts in memory
// Format: { chatId: { item_id: threshold_price_in_cents } }
const userAlerts = {};

// Store price check intervals
const priceCheckIntervals = {};

console.log('🤖 Telegram Bot starting...');

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `
🎉 Welcome to ACP Auto-Buy Bot!

This bot monitors product prices and auto-purchases when they drop below your alert threshold.

📝 Available commands:
/alert item_123 1500 - Set alert for T-Shirt when price drops below $15.00
/list - Show all products and their IDs
/myalerts - Show your current price alerts
/stop - Stop all alerts

💡 Example:
/alert item_123 1500
`;
  bot.sendMessage(chatId, welcomeText);
});

// /list command - Show all products
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  let listText = '📦 Available Products:\n\n';
  
  for (const [id, product] of Object.entries(products)) {
    listText += `${product.emoji} ${product.name}\n`;
    listText += `   ID: ${id}\n`;
  }
  
  listText += '\n💰 Use /alert <id> <price_in_cents> to set a price alert';
  bot.sendMessage(chatId, listText);
});

// /alert command - Set price alert
bot.onText(/\/alert\s+(\S+)\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const productId = match[1];
  const thresholdPrice = parseInt(match[2]);

  if (!products[productId]) {
    bot.sendMessage(chatId, `❌ Product ${productId} not found. Use /list to see available products.`);
    return;
  }

  // Store the alert
  if (!userAlerts[chatId]) {
    userAlerts[chatId] = {};
  }
  userAlerts[chatId][productId] = thresholdPrice;

  const product = products[productId];
  bot.sendMessage(
    chatId,
    `✅ Alert set for ${product.emoji} ${product.name}\n` +
    `When price drops below $${(thresholdPrice / 100).toFixed(2)}, I'll auto-purchase!\n\n` +
    `Now monitoring... 👀`
  );

  // Start price monitoring if not already running
  startPriceMonitoring(chatId);
});

// /myalerts command - Show user's alerts
bot.onText(/\/myalerts/, (msg) => {
  const chatId = msg.chat.id;

  if (!userAlerts[chatId] || Object.keys(userAlerts[chatId]).length === 0) {
    bot.sendMessage(chatId, '❌ You have no active alerts. Use /alert to set one.');
    return;
  }

  let alertsText = '📋 Your Active Alerts:\n\n';
  for (const [productId, threshold] of Object.entries(userAlerts[chatId])) {
    const product = products[productId];
    alertsText += `${product.emoji} ${product.name}\n`;
    alertsText += `   Alert: Price < $${(threshold / 100).toFixed(2)}\n\n`;
  }

  bot.sendMessage(chatId, alertsText);
});

// /stop command - Stop all alerts
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  if (priceCheckIntervals[chatId]) {
    clearInterval(priceCheckIntervals[chatId]);
    delete priceCheckIntervals[chatId];
  }

  delete userAlerts[chatId];

  bot.sendMessage(chatId, '✅ All alerts stopped. Use /alert to set new ones.');
});

// Price monitoring function
function startPriceMonitoring(chatId) {
  // Clear existing interval if any
  if (priceCheckIntervals[chatId]) {
    clearInterval(priceCheckIntervals[chatId]);
  }

  // Check prices every 30 seconds (for demo, normally would be longer)
  priceCheckIntervals[chatId] = setInterval(async () => {
    try {
      const alerts = userAlerts[chatId];
      if (!alerts || Object.keys(alerts).length === 0) {
        clearInterval(priceCheckIntervals[chatId]);
        delete priceCheckIntervals[chatId];
        return;
      }

      // Check each product's price
      for (const [productId, threshold] of Object.entries(alerts)) {
        const product = products[productId];

        // Create a test checkout to get current prices
        const response = await axios.post(`${API_BASE}/checkouts`, {
          items: [{ id: productId, quantity: 1 }],
          buyer: {
            first_name: 'Demo',
            last_name: 'User',
            email: 'demo@example.com',
          },
        });

        const currentPrice = response.data.line_items[0].base_amount;

        console.log(`[${chatId}] Checking ${product.name}: $${(currentPrice / 100).toFixed(2)} vs threshold $${(threshold / 100).toFixed(2)}`);

        // If price is below threshold, auto-purchase
        if (currentPrice < threshold) {
          bot.sendMessage(chatId, `🎉 ${product.emoji} Price dropped to $${(currentPrice / 100).toFixed(2)}!\n\n⏳ Auto-purchasing now...`);

          try {
            await autoPurchase(chatId, response.data.id, productId, product);
            
            // Remove this alert after purchase
            delete userAlerts[chatId][productId];
          } catch (err) {
            bot.sendMessage(chatId, `❌ Purchase failed: ${err.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`Price monitoring error for chat ${chatId}:`, error.message);
    }
  }, 30000); // Check every 30 seconds
}

// Auto-purchase function
async function autoPurchase(chatId, checkoutId, productId, product) {
  try {
    // Step 1: Update checkout with address
    await axios.put(`${API_BASE}/checkouts/${checkoutId}`, {
      fulfillment_address: DEMO_ADDRESS,
      fulfillment_option_id: 'shipping_standard',
    });

    // Step 2: Complete checkout (process payment)
    const response = await axios.post(`${API_BASE}/checkouts/${checkoutId}/complete`, {
      payment_data: {
        token: 'tok_visa',
        provider: 'stripe',
        billing_address: DEMO_ADDRESS,
      },
    });

    if (response.data.status === 'completed') {
      const total = response.data.totals.find(t => t.type === 'total').amount;
      bot.sendMessage(
        chatId,
        `✅ Order Placed!\n\n` +
        `${product.emoji} ${product.name}\n` +
        `Order ID: ${checkoutId}\n` +
        `Total: $${(total / 100).toFixed(2)}\n\n` +
        `Shipping to: ${DEMO_ADDRESS.line_one}, ${DEMO_ADDRESS.city}, ${DEMO_ADDRESS.state}`
      );
    } else {
      throw new Error('Order status is not completed');
    }
  } catch (error) {
    throw error;
  }
}

console.log('✅ Telegram Bot is running!');
console.log('Commands: /start, /list, /alert, /myalerts, /stop');

// Error handling
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Bot shutting down...');
  bot.stopPolling();
  process.exit(0);
});