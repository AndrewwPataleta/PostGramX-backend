import {I18nService, TranslateOptions} from 'nestjs-i18n';

export async function buildBilingualMessage(
    i18n: I18nService,
    key: string,
    options?: TranslateOptions,
): Promise<string> {
    const en = await i18n.t(key, {...options, lang: 'en'});
    const ru = await i18n.t(key, {...options, lang: 'ru'});
    if (en === ru) {
        return String(en);
    }
    return `${en}\n\n${ru}`;
}
