// File: index.js
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Konfigurasi bot Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware untuk menampilkan log pesan yang masuk
bot.use((ctx, next) => {
  console.log(`${ctx.from.username || ctx.from.first_name}: ${ctx.message?.text}`);
  return next();
});

// Command /start
bot.start((ctx) => {
  ctx.reply('👋 Halo! Saya adalah Bot AI yang menggunakan model dari OpenRouter. Silakan kirimkan pesan, dan saya akan meresponnya menggunakan AI.');
});

// Command /help
bot.help((ctx) => {
  ctx.reply(`
🤖 *Bot AI Telegram*

*Perintah yang tersedia:*
/start - Memulai bot
/help - Menampilkan bantuan
/models - Menampilkan model AI yang tersedia

*Penggunaan:*
Cukup ketikkan pesan Anda dan bot akan merespon menggunakan AI.

*Pengaturan Model:*
Gunakan perintah /model [nama_model] untuk mengubah model yang digunakan.
`, { parse_mode: 'Markdown' });
});

// Command /models untuk menampilkan model yang tersedia
bot.command('models', async (ctx) => {
  ctx.reply(`
*Model AI yang tersedia (gratis):*
- claude-instant-1 (Claude Instant, Anthropic)
- gemini-pro (Gemini Pro, Google)
- mistral-7b-instruct (Mistral 7B)
- llama2-70b (Llama 2 70B)
- j2-light (J2-Light)

Gunakan /model [nama_model] untuk mengubah model.
Contoh: /model gemini-pro
`, { parse_mode: 'Markdown' });
});

// Command untuk mengubah model yang digunakan
const userModels = {};
bot.command('model', (ctx) => {
  const modelName = ctx.message.text.split(' ')[1];
  if (!modelName) {
    return ctx.reply('Silakan tentukan nama model. Contoh: /model gemini-pro');
  }
  
  const validModels = ['claude-instant-1', 'gemini-pro', 'mistral-7b-instruct', 'llama2-70b', 'j2-light'];
  if (!validModels.includes(modelName)) {
    return ctx.reply(`Model '${modelName}' tidak valid. Gunakan /models untuk melihat daftar model yang tersedia.`);
  }
  
  userModels[ctx.from.id] = modelName;
  ctx.reply(`Model AI diubah ke: ${modelName}`);
});

// Fungsi untuk mengirim pesan ke OpenRouter API
async function generateAIResponse(message, userId) {
  // Default model jika user belum memilih
  const model = userModels[userId] || 'gemini-pro';
  
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: [
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://oprrtai-m0ybq65di-r3xbases-projects.vercel.app', // Ganti dengan URL vercel Anda
          'X-Title': 'Telegram AI Bot'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.response?.data || error.message);
    return '❌ Terjadi kesalahan saat menghubungi API. Silakan coba lagi nanti.';
  }
}

// Handle semua pesan teks
bot.on('text', async (ctx) => {
  // Abaikan pesan yang dimulai dengan '/'
  if (ctx.message.text.startsWith('/')) return;
  
  // Kirim indikator "typing..."
  ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
  
  try {
    // Tampilkan pesan loading
    const loadingMsg = await ctx.reply('🧠 Sedang berpikir...');
    
    // Dapatkan respons dari AI
    const aiResponse = await generateAIResponse(ctx.message.text, ctx.from.id);
    
    // Hapus pesan loading dan kirim respons AI
    ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    ctx.reply(aiResponse, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error processing message:', error);
    ctx.reply('❌ Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti.');
  }
});

// Jalankan webhook untuk Vercel
if (process.env.NODE_ENV === 'production') {
  // Set webhook
  app.use(bot.webhookCallback('/api/webhook'));
  
  // Rute untuk health check
  app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
  });
  
  // Rute untuk set webhook secara manual
  app.get('/api/set-webhook', async (req, res) => {
    const webhookUrl = `${process.env.VERCEL_URL}/api/webhook`;
    try {
      await bot.telegram.setWebhook(webhookUrl);
      res.status(200).send(`Webhook diatur ke: ${webhookUrl}`);
    } catch (error) {
      res.status(500).send(`Gagal mengatur webhook: ${error.message}`);
    }
  });
  
  // Fallback route
  app.use('*', (req, res) => {
    res.status(200).send('Bot Telegram AI sedang berjalan!');
  });
} else {
  // Jalankan bot dalam mode polling untuk development
  bot.launch().then(() => {
    console.log('Bot dijalankan dalam mode polling');
  });
}

// Tangani sinyal untuk menutup bot dengan baik
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Export Express app untuk Vercel
module.exports = app;
