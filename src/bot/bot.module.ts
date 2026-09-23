import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || 'DUMMY_TOKEN',
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'ad-queue',
    }),
  ],
  providers: [BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
