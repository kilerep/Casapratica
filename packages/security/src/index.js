import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
export const encryptionKeySchema = z.string().base64().transform(v => Buffer.from(v, "base64")).refine(v => v.length === 32, "key_must_be_32_bytes");
export class TokenCipher {
    key;
    constructor(key) {
        this.key = key;
        if (key.length !== 32)
            throw new Error("invalid_encryption_key");
    }
    encrypt(value) { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", this.key, iv); return { ciphertext: Buffer.concat([c.update(value, "utf8"), c.final()]), iv, authTag: c.getAuthTag() }; }
    decrypt(v) { const d = createDecipheriv("aes-256-gcm", this.key, v.iv); d.setAuthTag(v.authTag); return Buffer.concat([d.update(v.ciphertext), d.final()]).toString("utf8"); }
}
