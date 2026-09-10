const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a short, unambiguous room code. */
export function generateCode(length = 5, rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(rng() * ALPHABET.length);
    code += ALPHABET[index] ?? 'A';
  }
  return code;
}
