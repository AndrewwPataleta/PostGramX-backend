import * as crypto from 'crypto';

export function checkTelegramAuthorization(authData: string, log: any): boolean {
  try {
    log.log('Raw authData', authData);
    const initData = new URLSearchParams(authData);

    initData.sort();

    const hash = initData.get('hash');
    log.log('Hash from Telegram:', hash);

    if (!hash) {
      log.warn('No hash found in authData');
      return false;
    }

    initData.delete('hash');

    const dataToCheck = [...initData.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN || '')
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataToCheck)
      .digest('hex');

    log.log(`Calculated hash: ${calculatedHash}`);
    return hash === calculatedHash;
  } catch (error) {
    log.error('checkTelegramAuthorization ERROR', error);
    return false;
  }
}
