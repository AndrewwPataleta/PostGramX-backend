import {Injectable} from '@nestjs/common';
import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'crypto';
import {MtprotoAnalyticsConfigService} from './mtproto-analytics-config.service';

@Injectable()
export class MtprotoSessionCryptoService {
    constructor(
        private readonly configService: MtprotoAnalyticsConfigService,
    ) {}

    encrypt(sessionString: string): string {
        const key = this.getKey();
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([
            cipher.update(sessionString, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    }

    decrypt(encrypted: string): string {
        const payload = Buffer.from(encrypted, 'base64');
        const iv = payload.subarray(0, 12);
        const authTag = payload.subarray(12, 28);
        const ciphertext = payload.subarray(28);
        const key = this.getKey();
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return plaintext.toString('utf8');
    }

    private getKey(): Buffer {
        return createHash('sha256')
            .update(this.configService.sessionEncryptionKey)
            .digest();
    }
}
