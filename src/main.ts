import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { getBotToken } from 'nestjs-telegraf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  try {
    const bot = app.get(getBotToken());
    app.use(bot.webhookCallback('/telegraf-webhook'));
  } catch (e) {
    // Ignore if bot is not initialized
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
