export function buildMiniAppDealLink(dealId: string) {
    const baseUrl =
        process.env.TELEGRAM_MINIAPP_URL ||
        process.env.TELEGRAM_MINI_APP_URL ||
        process.env.MINI_APP_URL;
    if (!baseUrl) {
        return 'https://t.me';
    }

    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'https:') {
            return 'https://t.me';
        }
        url.pathname = `${url.pathname.replace(/\/$/, '')}/deals/${dealId}`;
        return url.toString();
    } catch (error) {
        return 'https://t.me';
    }
}
