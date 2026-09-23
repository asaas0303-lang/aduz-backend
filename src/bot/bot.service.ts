import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ad-queue') private readonly adQueue: Queue,
  ) {}

  async findOrCreateUser(telegramId: string, username?: string) {
    let user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId,
          username,
        },
      });
    }

    return user;
  }

  async setUserRole(telegramId: string, role: 'ADVERTISER' | 'CHANNEL_OWNER') {
    return this.prisma.user.update({
      where: { telegramId },
      data: { role },
    });
  }

  async verifyChannelAdmin(ownerId: string, telegramChatId: string, name: string) {
    let channel = await this.prisma.channel.findUnique({
      where: { telegramChatId },
    });

    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          ownerId,
          telegramChatId,
          name,
          isActive: true,
        },
      });
    } else {
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: { isActive: true },
      });
    }
    return channel;
  }
}
