import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ConfigService} from '@nestjs/config';
import {User} from '../modules/auth/entities/user.entity';
import {TelegramBotService} from '../modules/telegram-bot/telegram-bot.service';
import {TelegramInlineButton} from '../modules/telegram-bot/telegram-bot.types';
import {TelegramI18nService, TelegramLanguage} from './i18n/telegram-i18n.service';

export interface TelegramInlineButtonSpec {
    textKey: string;
    textArgs?: Record<string, any>;
    url?: string;
    webAppUrl?: string;
    callbackData?: string;
}

interface SendOptions {
    lang?: TelegramLanguage;
    parse_mode?: 'HTML' | 'Markdown';
}

interface SendMediaOptions extends SendOptions {
    buttons?: TelegramInlineButtonSpec[][];
}

@Injectable()
export class TelegramMessengerService {
    private readonly logger = new Logger(TelegramMessengerService.name);

    constructor(
        private readonly telegramBotService: TelegramBotService,
        private readonly telegramI18nService: TelegramI18nService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) {}

    async sendText(
        userIdOrChatId: string | number,
        key: string,
        args?: Record<string, any>,
        options?: SendOptions & {reply_markup?: {inline_keyboard: TelegramInlineButton[][]}},
    ): Promise<void> {
        const lang = await this.resolveLanguage(userIdOrChatId, options?.lang);
        const text = this.telegramI18nService.t(lang, key, args);
        await this.telegramBotService.sendMessage(userIdOrChatId, text, {
            parse_mode: options?.parse_mode,
            reply_markup: options?.reply_markup,
        });
    }

    async editText(
        chatId: string | number,
        messageId: string | number,
        key: string,
        args?: Record<string, any>,
        options?: SendOptions & {reply_markup?: {inline_keyboard: TelegramInlineButton[][]}},
    ): Promise<void> {
        const lang = await this.resolveLanguage(chatId, options?.lang);
        const text = this.telegramI18nService.t(lang, key, args);
        await this.telegramBotService.editMessageText(chatId, messageId, text, {
            parse_mode: options?.parse_mode,
            reply_markup: options?.reply_markup,
        });
    }

    async sendPhotoWithCaption(
        userIdOrChatId: string | number,
        fileId: string,
        captionKey: string,
        args?: Record<string, any>,
        options?: SendMediaOptions,
    ): Promise<void> {
        const lang = await this.resolveLanguage(userIdOrChatId, options?.lang);
        const caption = this.telegramI18nService.t(lang, captionKey, args);
        const reply_markup = options?.buttons
            ? {inline_keyboard: this.buildInlineKeyboard(options.buttons, lang)}
            : undefined;
        await this.telegramBotService.sendPhoto(userIdOrChatId, fileId, caption, {
            reply_markup,
        });
    }

    async sendVideoWithCaption(
        userIdOrChatId: string | number,
        fileId: string,
        captionKey: string,
        args?: Record<string, any>,
        options?: SendMediaOptions,
    ): Promise<void> {
        const lang = await this.resolveLanguage(userIdOrChatId, options?.lang);
        const caption = this.telegramI18nService.t(lang, captionKey, args);
        const reply_markup = options?.buttons
            ? {inline_keyboard: this.buildInlineKeyboard(options.buttons, lang)}
            : undefined;
        await this.telegramBotService.sendVideo(userIdOrChatId, fileId, caption, {
            reply_markup,
        });
    }

    async sendInlineKeyboard(
        userIdOrChatId: string | number,
        key: string,
        args: Record<string, any> | undefined,
        buttons: TelegramInlineButtonSpec[][],
        options?: SendOptions,
    ): Promise<void> {
        const lang = await this.resolveLanguage(userIdOrChatId, options?.lang);
        const text = this.telegramI18nService.t(lang, key, args);
        const inline_keyboard = this.buildInlineKeyboard(buttons, lang);
        await this.telegramBotService.sendMessage(userIdOrChatId, text, {
            parse_mode: options?.parse_mode,
            reply_markup: {inline_keyboard},
        });
    }

    async resolveLanguageForTelegramId(
        userIdOrChatId?: string | number | null,
        fallback: TelegramLanguage = 'en',
    ): Promise<TelegramLanguage> {
        if (!userIdOrChatId) {
            return fallback;
        }

        const telegramId = String(userIdOrChatId);
        const user = await this.userRepository.findOne({
            where: {telegramId},
        });

        return this.telegramI18nService.resolveLanguageForUser(user, fallback);
    }

    buildMiniAppUrl(route?: string): string {
        const baseUrl =
            this.configService.get<string>('TELEGRAM_MINIAPP_URL') ||
            this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');

        if (route && botUsername) {
            return `https://t.me/${botUsername}?startapp=${route}`;
        }

        if (baseUrl) {
            const normalized = this.ensureHttpsUrl(baseUrl);
            if (route && normalized) {
                try {
                    const url = new URL(normalized);
                    url.searchParams.set('startapp', route);
                    return url.toString();
                } catch (error) {
                    return normalized;
                }
            }
            return normalized ?? 'https://t.me';
        }

        if (botUsername) {
            return `https://t.me/${botUsername}`;
        }

        return 'https://t.me';
    }

    private async resolveLanguage(
        userIdOrChatId: string | number,
        preferred?: TelegramLanguage,
    ): Promise<TelegramLanguage> {
        if (preferred) {
            return preferred;
        }

        return this.resolveLanguageForTelegramId(userIdOrChatId);
    }

    private buildInlineKeyboard(
        buttons: TelegramInlineButtonSpec[][],
        lang: TelegramLanguage,
    ): TelegramInlineButton[][] {
        return buttons.map((row) =>
            row
                .map((button) => {
                    const text = this.telegramI18nService.t(
                        lang,
                        button.textKey,
                        button.textArgs,
                    );

                    const url = button.url
                        ? this.ensureHttpsUrl(button.url)
                        : undefined;
                    const webAppUrl = button.webAppUrl
                        ? this.ensureHttpsUrl(button.webAppUrl)
                        : undefined;

                    if (!url && button.url) {
                        this.logger.warn(
                            `Invalid inline button URL dropped: ${button.url}`,
                        );
                    }
                    if (!webAppUrl && button.webAppUrl) {
                        this.logger.warn(
                            `Invalid inline button web app URL dropped: ${button.webAppUrl}`,
                        );
                    }

                    const result: TelegramInlineButton = {
                        text,
                        callback_data: button.callbackData,
                    };

                    if (url) {
                        result.url = url;
                    }

                    if (webAppUrl) {
                        result.web_app = {url: webAppUrl};
                    }

                    if (!result.url && !result.web_app && !result.callback_data) {
                        return null;
                    }

                    return result;
                })
                .filter(
                    (button): button is TelegramInlineButton =>
                        Boolean(button?.text),
                ),
        );
    }

    private ensureHttpsUrl(url: string): string | null {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:') {
                return null;
            }
            return parsed.toString();
        } catch (error) {
            return null;
        }
    }
}
