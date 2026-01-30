export function buildMiniAppDealLink(dealId: string) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
        return 'https://t.me';
    }
    return `https://t.me/${botUsername}?startapp=deal_${dealId}`;
}
