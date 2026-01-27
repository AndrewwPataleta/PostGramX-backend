declare module 'telegraf' {
    export type MiddlewareFn<TContext = Context> = (context: TContext) => unknown;

    export class Telegraf<TContext = Context> {
        constructor(token: string);
        start(handler: MiddlewareFn<TContext>): void;
        command(command: string, handler: MiddlewareFn<TContext>): void;
        on(event: string, handler: MiddlewareFn<TContext>): void;
        catch(handler: (error: Error, context: TContext) => void): void;
        launch(options?: {allowedUpdates?: readonly string[]}): Promise<void>;
        stop(reason?: string): Promise<void>;
    }

    export interface CallbackQuery {
        data?: string;
    }

    export interface Context {
        updateType?: string;
        callbackQuery: CallbackQuery;
        message: {text?: string};
        reply(text: string, extra?: unknown): Promise<void>;
        answerCbQuery(): Promise<void>;
    }

    export class Markup {
        static inlineKeyboard(buttons: unknown[][]): unknown;
        static button: {
            url(text: string, url: string): unknown;
            callback(text: string, data: string): unknown;
        };
    }
}
