import {Injectable} from '@nestjs/common';
import {Context, Telegraf} from 'telegraf';
import {HelpHandler} from './handlers/help.handler';
import {StartHandler} from './handlers/start.handler';
import {TELEGRAM_BOT_COMMANDS} from './telegram-bot.constants';

@Injectable()
export class TelegramBotUpdate {
    constructor(
        private readonly startHandler: StartHandler,
        private readonly helpHandler: HelpHandler,
    ) {}

    register(bot: Telegraf<Context>): void {
        bot.start(async (context) => {
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

        bot.on('text', async (context) => {
            const messageText = context.message.text?.trim() ?? '';
            if (this.isKnownCommand(messageText)) {
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
        return [
            TELEGRAM_BOT_COMMANDS.start,
            TELEGRAM_BOT_COMMANDS.help,
        ].includes(command);
    }
}
