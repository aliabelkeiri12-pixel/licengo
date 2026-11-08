import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { documentKey, env } from "./env";

/**
 * Encrypted object storage. Files are encrypted client-side of the bucket with AES-256-GCM
 * (IV 12 bytes | auth tag 16 bytes | ciphertext). The local driver writes on disk; in production,
 * the same blobs go to an EU S3-compatible bucket (Scaleway / OVH, server-side encryption as a 2nd layer).
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  private file(key: string) {
    if (!/^[a-zA-Z0-9/_-]+$/.test(key)) throw new Error("Clé de stockage invalide");
    return path.join(path.resolve(env.storageDir), key);
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data, { mode: 0o600 });
  }
  get(key: string) { return readFile(this.file(key)); }
  async remove(key: string) { await unlink(this.file(key)).catch(() => undefined); }
}

const driver: StorageDriver = new LocalDriver();

export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", documentKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", documentKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

export async function storeEncrypted(prefix: string, data: Buffer) {
  const key = `${prefix}/${randomBytes(16).toString("hex")}`;
  await driver.put(key, encrypt(data));
  return { key, sha256: createHash("sha256").update(data).digest("hex") };
}

export const readDecrypted = async (key: string) => decrypt(await driver.get(key));
export const removeObject = (key: string) => driver.remove(key);
