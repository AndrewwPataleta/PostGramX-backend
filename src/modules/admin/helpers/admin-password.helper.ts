import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(nodeScrypt);

export async function hashAdminPassword(password: string): Promise<{
  hash: string;
  salt: string;
}> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

export async function verifyAdminPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  if (!password || !salt || !hash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedHash = Buffer.from(hash, 'hex');

  if (storedHash.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedHash, derivedKey);
}
