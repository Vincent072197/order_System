import { hash, verify } from "@node-rs/argon2";

// argon2id with parameters in the OWASP "memory-hard, low-time-cost" family.
// 19 MiB / 2 iterations / 1 lane is a defensible 2024 baseline for an
// interactive login flow. Tune up if benchmarks show headroom on prod.
// We omit `algorithm` here — @node-rs/argon2 defaults to Argon2id, and
// referring to the const enum would break under `isolatedModules`.
const ARGON2_PARAMS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_PARAMS);
}

export async function verifyPassword(
  hashStr: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(hashStr, password);
  } catch {
    return false;
  }
}

// Lazy dummy hash so we can verify against *something* on the
// "user not found" branch and keep response time constant. We hash once and
// cache; the plaintext is irrelevant.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash(
      "definitely-not-a-real-password-just-for-timing",
      ARGON2_PARAMS,
    );
  }
  return dummyHashPromise;
}

export async function dummyVerify(password: string): Promise<void> {
  const dummy = await getDummyHash();
  try {
    await verify(dummy, password);
  } catch {
    /* irrelevant */
  }
}
