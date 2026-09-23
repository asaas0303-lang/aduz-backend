import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

@Processor('ad-queue')
export class AdProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    @InjectBot() private bot: Telegraf,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { adId } = job.data;
    console.log(`Processing ad job for adId: ${adId}`);

    const ad = await this.prisma.adCampaign.findUnique({
      where: { id: adId },
      include: { channel: true },
    });

    if (!ad || ad.status !== 'SCHEDULED') {
      console.error('Ad not found or not in SCHEDULED status');
      return;
    }

    try {
      // Send message to the channel
      await this.bot.telegram.sendMessage(ad.channel.telegramChatId, ad.content);

      // Mark ad as completed
      await this.prisma.adCampaign.update({
        where: { id: ad.id },
        data: { status: 'COMPLETED' },
      });

      // Payout to channel owner
      await this.walletService.payoutToChannelOwner(ad.channel.id, ad.channel.price, ad.id);
      
      console.log(`Ad ${adId} successfully posted and payout released.`);
    } catch (error) {
      console.error(`Failed to post ad ${adId}:`, error);
      // Depending on retry logic, we might throw or handle it
      throw error;
    }
  }
}
