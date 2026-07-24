import { createHash, timingSafeEqual } from 'node:crypto';

const sha256Hex = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * Integrity signature the gateway recomputes to confirm the amount and reference
 * were not tampered with between the browser and the gateway.
 */
export const buildIntegritySignature = (input: {
  reference: string;
  amountInCents: number;
  currency: string;
  integrityKey: string;
}): string =>
  sha256Hex(`${input.reference}${input.amountInCents}${input.currency}${input.integrityKey}`);

/** Reads a dotted path such as "transaction.amount_in_cents" out of an event body. */
export const readProperty = (source: Record<string, unknown>, path: string): string => {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);

  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();

  // Objects and arrays are never part of a signed property path.
  return '';
};

export const buildEventChecksum = (input: {
  data: Record<string, unknown>;
  properties: string[];
  timestamp: number;
  eventsKey: string;
}): string => {
  const concatenated = input.properties
    .map((property) => readProperty(input.data, property))
    .join('');

  return sha256Hex(`${concatenated}${input.timestamp}${input.eventsKey}`);
};

/** Constant-time comparison so a mismatch cannot be probed byte by byte. */
export const checksumMatches = (expected: string, received: string): boolean => {
  const expectedBuffer = Buffer.from(expected.toLowerCase(), 'utf8');
  const receivedBuffer = Buffer.from(received.trim().toLowerCase(), 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};
