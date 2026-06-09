import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';

const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

async function generateKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password.normalize('NFKC'),
      salt,
      config.dkLen,
      {
        N: config.N,
        r: config.r,
        p: config.p,
        maxmem: 128 * config.N * config.r * 2,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');

  if (!salt || !key) {
    return false;
  }

  const expected = Buffer.from(key, 'hex');
  const actual = await generateKey(password, salt);

  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function runDummyPasswordHash(password: string) {
  await hashPassword(password);
}
