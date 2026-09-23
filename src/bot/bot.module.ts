import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update.js';
import { BotService } from './bot.service.js';
import { BullModule } from '@nestjs/bullmq';
import { AdModule } from '../ad/ad.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    AdModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token || token === 'DUMMY_TOKEN') {
          throw new Error('TELEGRAM_BOT_TOKEN is missing! Please configure it in Railway.');
        }

        const domain = configService.get<string>('RAILWAY_PUBLIC_DOMAIN');
        if (domain) {
          return {
            token,
            launchOptions: {
              webhook: {
                domain: `https://${domain}`,
                hookPath: '/telegraf-webhook',
              },
            },
          };
        }

        return {
          token,
          launchOptions: {
            dropPendingUpdates: true,
          },
        };
      },
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
