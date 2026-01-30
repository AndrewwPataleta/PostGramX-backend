import crypto from "crypto";

type EncryptedBlob = {
    iv: string;
    tag: string;
    data: string;
};

export class WalletKeyStore {
    constructor(private readonly masterKey: Buffer) {
        if (masterKey.length < 32) throw new Error("MASTER key too short");
    }

    encryptMnemonic(words: string[]): EncryptedBlob {
        const iv = crypto.randomBytes(12);
        const key = crypto.createHash("sha256").update(this.masterKey).digest(); // 32 bytes
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

        const plaintext = words.join(" ");
        const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
            iv: iv.toString("hex"),
            tag: tag.toString("hex"),
            data: enc.toString("hex"),
        };
    }

    decryptMnemonic(blob: EncryptedBlob): string[] {
        const iv = Buffer.from(blob.iv, "hex");
        const tag = Buffer.from(blob.tag, "hex");
        const data = Buffer.from(blob.data, "hex");
        const key = crypto.createHash("sha256").update(this.masterKey).digest();

        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);

        const dec = Buffer.concat([decipher.update(data), decipher.final()]);
        return dec.toString("utf8").split(" ");
    }
}
