import { Telegraf, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { code } from 'telegraf/format';
import config from 'config';
import axios from 'axios';
import { ogg } from './src/ogg.js';
import { openaiGPT } from './src/openai.js';

const INITIAL_SESSION = {
  messages: [],
};

const BOT_TOKEN = config.get('TELEGRAM_TOKEN');
const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

bot.command('new', async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply('Жду вашего голосового или текстового сообщения');
});
bot.command('start', async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply('Жду вашего голосового или текстового сообщения');
});

bot.on(message('voice'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);
    const name = ctx.from.first_name;
    const text = await openaiGPT.transcription(mp3Path);

    if (text.includes('Кеша')) {
      const textAsked = text.slice(5);

      await ctx.reply(code(`${name} Ваш запрос: ${textAsked}`));

      ctx.session.messages.push({ role: openaiGPT.roles.USER, content: textAsked });

      const response = await openaiGPT.chat(ctx.session.messages);

      ctx.session.messages.push({
        role: openaiGPT.roles.ASSISTANT,
        content: response,
      });

      await ctx.reply(response);
    }
  } catch (error) {
    console.log(error.message);
  }
});

bot.on(message('text'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  const text = ctx.message.text;

  if (text.includes('Кеша')) {
    const textAsked = text.slice(5);
    try {
      await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'));
      ctx.session.messages.push({ role: openaiGPT.roles.USER, content: textAsked });

      const response = await openaiGPT.chat(ctx.session.messages);

      ctx.session.messages.push({
        role: openaiGPT.roles.ASSISTANT,
        content: response,
      });
      const name = ctx.from.first_name;
      await ctx.reply(`${name}, ${response}`);
    } catch (err) {
      console.log(err, 'error response');
      const name = ctx.from.first_name;
      ctx.reply(
        `${name}, "Извините. Но из-за высокой нагрузки на сервер, я не смогу ответить Вам".`,
      );
    }
  }

  if (text.match(/^цена (.+)$/i)) {
    const stockName = text.match(/^цена (.+)$/i)[1];

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${stockName}?modules=price`;
    try {
      const response = await axios.get(url);
      const price = response.data.quoteSummary.result[0].price.regularMarketPrice.raw;

      ctx.reply(`Текущая цена ${stockName} составляет ${price}`);
    } catch (error) {
      console.error(error);
      ctx.reply('Произошла ошибка при получении цены акции. Попробуйте еще раз позже.');
    }
  }
});

bot.on('error', (error) => {
  console.log(error);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
