import crypto from "crypto";

export function encryptMnemonic(words: string[], masterKey: string) {
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update(masterKey).digest(); // 32 bytes
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const plaintext = words.join(" ");
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return JSON.stringify({
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        data: enc.toString("hex"),
    });
}


function decryptMnemonic(encJson: string, masterKey: string): string[] {
    const blob = JSON.parse(encJson) as { iv: string; tag: string; data: string };

    const iv = Buffer.from(blob.iv, "hex");
    const tag = Buffer.from(blob.tag, "hex");
    const data = Buffer.from(blob.data, "hex");

    const key = crypto.createHash("sha256").update(masterKey).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8").split(" ");
}