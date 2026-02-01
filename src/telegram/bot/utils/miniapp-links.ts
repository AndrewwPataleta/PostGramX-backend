export function buildMiniAppDealLink(dealId: string) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
        return 'https://t.me';
    }
    return `https://t.me/${botUsername}?startapp=deal_${dealId}`;
}

export function buildMiniAppUrl(path: string): string | null {
    if (!path) {
        return null;
    }

    try {
        const url = new URL(path);
        if (url.protocol !== 'https:') {
            return null;
        }
        return url.toString();
    } catch (error) {
        return null;
    }
}
