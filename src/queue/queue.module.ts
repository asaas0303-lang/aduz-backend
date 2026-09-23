import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdProcessor } from './ad.processor.js';
import { WalletModule } from '../wallet/wallet.module.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ad-queue',
    }),
    WalletModule,
  ],
  providers: [AdProcessor],
})
export class QueueModule {}
