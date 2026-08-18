import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type MetaTokenPayload = {
  accessToken: string;
  refreshToken?: string | null;
};

export function encryptMetaTokenPayload(payload: MetaTokenPayload) {
  if (!payload.accessToken) throw new Error("Meta access token is required.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMetaTokenPayload(value: string): MetaTokenPayload {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored Meta authorization is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  const payload = JSON.parse(plaintext) as MetaTokenPayload;
  if (!payload?.accessToken || typeof payload.accessToken !== "string") throw new Error("Stored Meta authorization is invalid.");
  return payload;
}

function getEncryptionKey() {
  const value = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error("META_TOKEN_ENCRYPTION_KEY must contain 32 bytes.");
  return key;
}
