jest.mock(
    'telegraf',
    () => ({
        Telegraf: class {
            telegram = {
                sendMessage: jest.fn(),
                sendPhoto: jest.fn(),
                sendVideo: jest.fn(),
                editMessageText: jest.fn(),
            };
            use = jest.fn();
            start = jest.fn();
            command = jest.fn();
            on = jest.fn();
            catch = jest.fn();
            launch = jest.fn();
            stop = jest.fn();
        },
    }),
    {virtual: true},
);

import {TelegramMessengerService} from './telegram-messenger.service';
import {TelegramI18nService} from './i18n/telegram-i18n.service';

const createTranslator = () => {
    const translations = new Map<string, string>([
        ['en:telegram.common.open_mini_app', 'Open Mini App'],
        ['ru:telegram.common.open_mini_app', 'Открыть мини-приложение'],
    ]);

    return {
        translate: jest.fn((key: string, options?: {lang?: string}) => {
            const lang = options?.lang ?? 'en';
            return translations.get(`${lang}:${key}`) ?? key;
        }),
    };
};

describe('TelegramMessengerService', () => {
    const botService = {
        sendMessage: jest.fn(),
        sendPhoto: jest.fn(),
        sendVideo: jest.fn(),
        editMessageText: jest.fn(),
    };
    const userRepository = {
        findOne: jest.fn(),
    };
    const configService = {
        get: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sends Russian text when user.lang is ru', async () => {
        userRepository.findOne.mockResolvedValue({lang: 'ru', telegramId: '1'});
        const translator = createTranslator();
        const i18nService = new TelegramI18nService(translator as any);
        const messenger = new TelegramMessengerService(
            botService as any,
            i18nService,
            userRepository as any,
            configService as any,
        );

        await messenger.sendText(1, 'telegram.common.open_mini_app');

        expect(botService.sendMessage).toHaveBeenCalledWith(
            1,
            'Открыть мини-приложение',
            {parse_mode: undefined, reply_markup: undefined},
        );
    });

    it('sends English text when user.lang is en', async () => {
        userRepository.findOne.mockResolvedValue({lang: 'en', telegramId: '2'});
        const translator = createTranslator();
        const i18nService = new TelegramI18nService(translator as any);
        const messenger = new TelegramMessengerService(
            botService as any,
            i18nService,
            userRepository as any,
            configService as any,
        );

        await messenger.sendText(2, 'telegram.common.open_mini_app');

        expect(botService.sendMessage).toHaveBeenCalledWith(
            2,
            'Open Mini App',
            {parse_mode: undefined, reply_markup: undefined},
        );
    });

    it('normalizes ru-RU to ru', async () => {
        userRepository.findOne.mockResolvedValue({lang: 'ru-RU', telegramId: '3'});
        const translator = createTranslator();
        const i18nService = new TelegramI18nService(translator as any);
        const messenger = new TelegramMessengerService(
            botService as any,
            i18nService,
            userRepository as any,
            configService as any,
        );

        await messenger.sendText(3, 'telegram.common.open_mini_app');

        expect(botService.sendMessage).toHaveBeenCalledWith(
            3,
            'Открыть мини-приложение',
            {parse_mode: undefined, reply_markup: undefined},
        );
    });

    it('defaults to English when user is not found', async () => {
        userRepository.findOne.mockResolvedValue(null);
        const translator = createTranslator();
        const i18nService = new TelegramI18nService(translator as any);
        const messenger = new TelegramMessengerService(
            botService as any,
            i18nService,
            userRepository as any,
            configService as any,
        );

        await messenger.sendText(4, 'telegram.common.open_mini_app');

        expect(botService.sendMessage).toHaveBeenCalledWith(
            4,
            'Open Mini App',
            {parse_mode: undefined, reply_markup: undefined},
        );
    });
});
