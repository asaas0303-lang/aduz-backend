import { Module } from '@nestjs/common';
import { AdService } from './ad.service.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    WalletModule,
    BullModule.registerQueue({
      name: 'ad-queue',
    }),
  ],
  providers: [AdService],
  exports: [AdService],
})
export class AdModule {}
