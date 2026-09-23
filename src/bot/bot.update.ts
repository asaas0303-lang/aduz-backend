import { Update, Start, Action, On, Ctx, Command } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { AdService } from '../ad/ad.service';
import { PrismaService } from '../prisma/prisma.service';

@Update()
export class BotUpdate {
  constructor(
    private readonly botService: BotService,
    private readonly adService: AdService,
    private readonly prisma: PrismaService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    const username = ctx.from?.username;

    if (!telegramId) return;

    await this.botService.findOrCreateUser(telegramId, username);

    await ctx.reply(
      'Welcome to ADUZ - Telegram Advertising Marketplace! 🚀\n\nPlease select your role:',
      Markup.inlineKeyboard([
        Markup.button.callback('📢 Advertiser', 'role_advertiser'),
        Markup.button.callback('📺 Channel Owner', 'role_channel_owner'),
      ])
    );
  }

  @Action('role_advertiser')
  async onRoleAdvertiser(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    
    await this.botService.setUserRole(telegramId, 'ADVERTISER');
    await ctx.reply(
      'You are now registered as an Advertiser! 📢\n\nYou have received a starting balance of 1,000,000 UZS.\n\nUse /create_ad to submit a new ad.'
    );
  }

  @Action('role_channel_owner')
  async onRoleChannelOwner(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    await this.botService.setUserRole(telegramId, 'CHANNEL_OWNER');
    await ctx.reply(
      'You are now registered as a Channel Owner! 📺\n\nTo add your channel to the marketplace, simply add this bot to your channel as an Administrator. The bot will automatically verify and register your channel.'
    );
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: Context) {
    const update = ctx.update as any;
    const myChatMember = update.my_chat_member;
    
    // Check if it's a channel and bot was promoted to admin
    if (myChatMember.chat.type === 'channel' && myChatMember.new_chat_member.status === 'administrator') {
      const channelId = myChatMember.chat.id.toString();
      const channelTitle = myChatMember.chat.title;
      const ownerId = myChatMember.from.id.toString();

      try {
        const owner = await this.botService.findOrCreateUser(ownerId, myChatMember.from.username);
        await this.botService.verifyChannelAdmin(owner.id, channelId, channelTitle);
        
        // Notify the owner
        await ctx.telegram.sendMessage(
          ownerId,
          `✅ Successfully registered channel: **${channelTitle}**.\n\nYou can now manage its pricing and empty slots.`
        );
      } catch (error) {
        console.error('Failed to register channel', error);
      }
    }
  }

  @Command('create_ad')
  async onCreateAd(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.role !== 'ADVERTISER') {
      return ctx.reply('You must be an ADVERTISER to create an ad.');
    }

    const message = (ctx.message as any).text;
    const parts = message.split('|');
    if (parts.length < 3) {
      return ctx.reply('Usage: /create_ad | <channelId> | <Your ad content here>');
    }

    const channelId = parts[1].trim();
    const content = parts.slice(2).join('|').trim();

    try {
      const ad = await this.adService.createAdCampaign(telegramId, channelId, content);
      await ctx.reply(`✅ Ad campaign created successfully! (ID: ${ad.id}).\n\nYour funds are in escrow pending moderation.`);
    } catch (error: any) {
      await ctx.reply(`❌ Failed to create ad: ${error.message}`);
    }
  }

  @Command('moderate')
  async onModerate(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.role !== 'ADMIN') {
      return ctx.reply('Unauthorized. Admin only.');
    }

    const message = (ctx.message as any).text;
    const parts = message.split(' ');
    if (parts.length < 3) {
      return ctx.reply('Usage: /moderate <adId> <APPROVE|REJECT>');
    }

    const adId = parts[1];
    const action = parts[2] as 'APPROVE' | 'REJECT';

    try {
      await this.adService.moderateAd(adId, action);
      await ctx.reply(`✅ Ad ${adId} moderated as ${action}.`);
    } catch (error: any) {
      await ctx.reply(`❌ Failed to moderate ad: ${error.message}`);
    }
  }
}
