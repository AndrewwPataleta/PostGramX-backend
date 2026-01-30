import {Injectable} from '@nestjs/common';
import {Context, Telegraf} from 'telegraf';
import {HelpHandler} from './handlers/help.handler';
import {StartHandler} from './handlers/start.handler';
import {TELEGRAM_BOT_COMMANDS} from './telegram-bot.constants';
import {DealsBotHandler} from '../deals/deals-bot.handler';

@Injectable()
export class TelegramBotUpdate {
    constructor(
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
        private readonly dealsBotHandler: DealsBotHandler,
    ) {}

    register(bot: Telegraf<Context>): void {
        bot.start(async (context) => {
            const handled = await this.dealsBotHandler.handleStart(context);
            if (handled) {
                return;
            }

            await context.reply(
                this.startHandler.getMessage(),
                this.startHandler.getKeyboard(),
            );
        });

        bot.command(TELEGRAM_BOT_COMMANDS.help, async (context) => {
            await context.reply(
                this.helpHandler.getMessage(),
                this.helpHandler.getKeyboard(),
            );
        });

        bot.on('callback_query', async (context) => {
            const data =
                'data' in context.callbackQuery
                    ? context.callbackQuery.data
                    : undefined;
            if (data === 'help') {
                await context.answerCbQuery();
                await context.reply(
                    this.helpHandler.getMessage(),
                    this.helpHandler.getKeyboard(),
                );
            }
        });

        bot.on('message', async (context) => {
            if ('text' in context.message) {
                return;
            }

            const handled = await this.dealsBotHandler.handleCreativeMessage(
                context,
            );
            if (handled) {
                return;
            }
        });

        bot.on('text', async (context) => {
            const messageText = context.message.text?.trim() ?? '';
            if (this.isKnownCommand(messageText)) {
                return;
            }

            const handled = await this.dealsBotHandler.handleCreativeMessage(
                context,
            );
            if (handled) {
                return;
            }

            if (messageText.startsWith('/')) {
                await context.reply('I don’t recognize this command. Type /help.');
                return;
            }

            await context.reply(
                'To manage deals, open the Mini App. Type /help.',
            );
        });
    }

    private isKnownCommand(text: string): boolean {
        if (!text.startsWith('/')) {
            return false;
        }

        const command = text.split(' ')[0].replace('/', '').toLowerCase();
        const knownCommands = Object.values(TELEGRAM_BOT_COMMANDS) as string[];
        return knownCommands.includes(command);
    }
}
