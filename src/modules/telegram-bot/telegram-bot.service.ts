import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Context, Telegraf} from 'telegraf';
import {
    TELEGRAM_BOT_ALLOWED_UPDATES_DEFAULT,
    TELEGRAM_BOT_DEFAULT_MODE,
    TELEGRAM_BOT_MODULE_NAME,
    TELEGRAM_BOT_RECONNECT_DELAY_MS,
} from './telegram-bot.constants';
import {TelegramBotUpdate} from './telegram-bot.update';
import {TelegramBotConfig, TelegramInlineButton, TelegramBotMode} from './telegram-bot.types';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TELEGRAM_BOT_MODULE_NAME);
    private bot?: Telegraf<Context>;
    private reconnectTimeout?: NodeJS.Timeout;
    private config!: TelegramBotConfig;

    constructor(
        private readonly configService: ConfigService,
        private readonly updateRegistry: TelegramBotUpdate,
    ) {}

    onModuleInit(): void {
        this.config = this.loadConfig();
        this.ensureValidConfig(this.config);
        this.initializeBot();
    }

    async onModuleDestroy(): Promise<void> {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.bot) {
            await this.bot.stop('SIGTERM');
            this.logger.log('Telegram bot stopped.');
        }
    }

    async sendMessage(
        userTelegramId: string,
        text: string,
        buttons?: TelegramInlineButton[][],
    ): Promise<void> {
        void userTelegramId;
        void text;
        void buttons;
        this.logger.warn('sendMessage is not implemented yet.');
    }

    async sendDealStatusUpdate(
        userTelegramId: string,
        dealId: string,
        status: string,
    ): Promise<void> {
        void userTelegramId;
        void dealId;
        void status;
        this.logger.warn('sendDealStatusUpdate is not implemented yet.');
    }

    private initializeBot(): void {
        if (this.config.mode !== 'polling') {
            this.logger.warn(
                `Bot mode is set to ${this.config.mode}; polling will not start.`,
            );
            return;
        }

        this.bot = new Telegraf<Context>(this.config.token);
        this.updateRegistry.register(this.bot);

        this.bot.catch((error, context) => {
            const updateType = context.updateType;
            this.logger.error(
                `Telegram bot error on update type ${updateType}: ${error.message}`,
                error.stack,
            );
        });

        this.launchPolling();
    }

    private launchPolling(): void {
        if (!this.bot) {
            return;
        }

        this.bot
            .launch({allowedUpdates: this.config.allowedUpdates})
            .then(() => {
                this.logger.log('Telegram bot started with polling.');
            })
            .catch((error: Error) => {
                this.logger.error(
                    `Failed to start Telegram bot: ${error.message}`,
                    error.stack,
                );
                this.scheduleReconnect();
            });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            return;
        }

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = undefined;
            this.logger.warn('Retrying Telegram bot polling startup.');
            this.launchPolling();
        }, TELEGRAM_BOT_RECONNECT_DELAY_MS);
    }

    private loadConfig(): TelegramBotConfig {
        const modeValue =
            (this.configService.get<string>('TELEGRAM_BOT_MODE') ||
                TELEGRAM_BOT_DEFAULT_MODE)
                .toLowerCase();
        const mode = this.parseMode(modeValue);

        const allowedUpdatesRaw =
            this.configService.get<string>('TELEGRAM_ALLOWED_UPDATES');
        const allowedUpdates = allowedUpdatesRaw
            ? allowedUpdatesRaw
                  .split(',')
                  .map((value) => value.trim())
                  .filter((value) => value.length > 0)
            : [...TELEGRAM_BOT_ALLOWED_UPDATES_DEFAULT];

        return {
            token: this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
            username: this.configService.get<string>('TELEGRAM_BOT_USERNAME'),
            miniAppUrl: this.configService.get<string>('TELEGRAM_MINI_APP_URL'),
            mode,
            webhookUrl: this.configService.get<string>('TELEGRAM_WEBHOOK_URL'),
            allowedUpdates,
        };
    }

    private parseMode(mode: string): TelegramBotMode {
        return mode === 'webhook' ? 'webhook' : 'polling';
    }

    private ensureValidConfig(config: TelegramBotConfig): void {
        if (!config.token) {
            throw new Error(
                'TELEGRAM_BOT_TOKEN is required to start the Telegram bot.',
            );
        }

        if (!config.miniAppUrl) {
            this.logger.warn(
                'TELEGRAM_MINI_APP_URL is not set. Mini App buttons will be limited.',
            );
        }

        if (config.mode === 'webhook' && !config.webhookUrl) {
            this.logger.warn(
                'TELEGRAM_WEBHOOK_URL is not set; webhook mode is not fully configured.',
            );
        }
    }
}
