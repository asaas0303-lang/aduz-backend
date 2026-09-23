import { Update, Start, Action, On, Ctx, Command } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service.js';
import { AdService } from '../ad/ad.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
      'ADUZ - Telegram reklama bozoriga xush kelibsiz! \ud83d\ude80\n\nIltimos, rolingizni tanlang:',
      Markup.inlineKeyboard([
        Markup.button.callback('\ud83d\udce2 Reklama beruvchi', 'role_advertiser'),
        Markup.button.callback('\ud83d\udcfa Kanal egasi', 'role_channel_owner'),
      ])
    );
  }

  @Action('role_advertiser')
  async onRoleAdvertiser(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    
    await this.botService.setUserRole(telegramId, 'ADVERTISER');
    await ctx.reply(
      'Siz endi Reklama beruvchi sifatida ro\'yxatdan o\'tdingiz! \ud83d\udce2\n\nSizga 1,000,000 UZS boshlang\'ich balans berildi.\n\nYangi reklama yuborish uchun /create_ad buyrug\'idan foydalaning.'
    );
  }

  @Action('role_channel_owner')
  async onRoleChannelOwner(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    await this.botService.setUserRole(telegramId, 'CHANNEL_OWNER');
    await ctx.reply(
      'Siz endi Kanal egasi sifatida ro\'yxatdan o\'tdingiz! \ud83d\udcfa\n\nKanalingizni bozorga qo\'shish uchun, shunchaki ushbu botni kanalingizga Administrator sifatida qo\'shing. Bot kanalingizni avtomatik ravishda tekshiradi va ro\'yxatdan o\'tkazadi.'
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
          `✅ Kanal muvaffaqiyatli ro'yxatdan o'tkazildi: **${channelTitle}**.\n\nEndi uning narxlarini va bo'sh o'rinlarini boshqarishingiz mumkin.`
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
      return ctx.reply('Reklama yaratish uchun siz REKLAMA BERUVCHI bo\'lishingiz kerak.');
    }

    const message = (ctx.message as any).text;
    const parts = message.split('|');
    if (parts.length < 3) {
      return ctx.reply('Foydalanish: /create_ad | <Kanal_ID> | <Reklama matni>');
    }

    const channelId = parts[1].trim();
    const content = parts.slice(2).join('|').trim();

    try {
      const ad = await this.adService.createAdCampaign(telegramId, channelId, content);
      await ctx.reply(`✅ Reklama kampaniyasi muvaffaqiyatli yaratildi! (ID: ${ad.id}).\n\nMablag'laringiz moderatsiya qilinguncha band qilib qo'yildi.`);
    } catch (error: any) {
      await ctx.reply(`❌ Reklama yaratishda xatolik: ${error.message}`);
    }
  }

  @Command('moderate')
  async onModerate(@Ctx() ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.role !== 'ADMIN') {
      return ctx.reply('Ruxsat etilmagan. Faqat adminlar uchun.');
    }

    const message = (ctx.message as any).text;
    const parts = message.split(' ');
    if (parts.length < 3) {
      return ctx.reply('Foydalanish: /moderate <ad_ID> <APPROVE|REJECT>');
    }

    const adId = parts[1];
    const action = parts[2] as 'APPROVE' | 'REJECT';

    try {
      await this.adService.moderateAd(adId, action);
      await ctx.reply(`✅ ${adId}-IDli reklama ${action} sifatida moderatsiya qilindi.`);
    } catch (error: any) {
      await ctx.reply(`❌ Reklamani moderatsiya qilishda xatolik: ${error.message}`);
    }
  }
}
