// File: api/webhook.js
const { createServer } = require('http');
const { createBotHandler } = require('node-telegram-bot-api');
const app = require('../index');

// Buat handler untuk webhook Telegram
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    // Tangani webhook Telegram
    app(req, res);
  } else {
    // Respons untuk metode lainnya
    res.status(200).send('Webhook handler for Telegram bot is ready');
  }
};
