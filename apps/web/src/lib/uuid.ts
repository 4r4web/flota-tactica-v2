/**
 * RFC 4122 v4 UUID generator with a fallback for non-secure contexts.
 *
 * `crypto.randomUUID` is only available in secure contexts (HTTPS or
 * localhost). When the app is opened over plain HTTP on a LAN IP (for example
 * http://192.168.1.35:8080), it is undefined, so we fall back to a
 * Math.random-based v4 generator.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
