export function buildMiniAppDealLink(dealId: string) {
    const baseUrl = process.env.MINI_APP_URL;
    if (!baseUrl) {
        return 'https://t.me';
    }

    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'https:') {
            return baseUrl;
        }
        url.pathname = `${url.pathname.replace(/\/$/, '')}/deals/${dealId}`;
        return url.toString();
    } catch (error) {
        return baseUrl;
    }
}
