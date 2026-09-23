import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AdService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    @InjectQueue('ad-queue') private adQueue: Queue,
  ) {}

  async createAdCampaign(advertiserTelegramId: string, channelId: string, content: string) {
    const user = await this.prisma.user.findUnique({ where: { telegramId: advertiserTelegramId } });
    if (!user) throw new BadRequestException('Foydalanuvchi topilmadi');

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.isActive) throw new BadRequestException('Kanal mavjud emas');

    // Deduct from escrow
    const ad = await this.prisma.adCampaign.create({
      data: {
        advertiserId: user.id,
        channelId: channel.id,
        content,
        status: 'PENDING',
      },
    });

    await this.walletService.deductEscrow(user.id, channel.price, ad.id);
    return ad;
  }

  async moderateAd(adId: string, action: 'APPROVE' | 'REJECT', scheduledFor?: Date) {
    const ad = await this.prisma.adCampaign.findUnique({ where: { id: adId }, include: { channel: true, advertiser: true } });
    if (!ad) throw new BadRequestException('Reklama topilmadi');

    if (action === 'REJECT') {
      // Refund wallet
      await this.prisma.$transaction([
        this.prisma.adCampaign.update({ where: { id: adId }, data: { status: 'REJECTED' } }),
        this.prisma.user.update({ where: { id: ad.advertiserId }, data: { walletBalance: { increment: ad.channel.price } } }),
      ]);
      return { status: 'REJECTED' };
    }

    // Approve and Schedule
    const updatedAd = await this.prisma.adCampaign.update({
      where: { id: adId },
      data: {
        status: 'SCHEDULED',
        scheduledFor: scheduledFor || new Date(),
      },
    });

    // Calculate delay
    const delay = scheduledFor ? scheduledFor.getTime() - Date.now() : 0;
    
    // Add to BullMQ
    await this.adQueue.add('post-ad', { adId: updatedAd.id }, { delay: Math.max(0, delay) });

    return updatedAd;
  }
}
