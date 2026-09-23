import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async deductEscrow(userId: string, amount: number, relatedAdId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.walletBalance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: user.walletBalance - amount },
      });

      return tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'ESCROW',
          relatedAdId,
        },
      });
    });
  }

  async payoutToChannelOwner(channelId: string, amount: number, relatedAdId: string) {
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.findUnique({ where: { id: channelId } });
      if (!channel) throw new BadRequestException('Channel not found');

      const owner = await tx.user.update({
        where: { id: channel.ownerId },
        data: { walletBalance: { increment: amount } },
      });

      return tx.transaction.create({
        data: {
          userId: owner.id,
          amount,
          type: 'PAYOUT',
          relatedAdId,
        },
      });
    });
  }
}
