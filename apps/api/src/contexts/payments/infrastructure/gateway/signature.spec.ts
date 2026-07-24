import { createHash } from 'node:crypto';

import {
  buildEventChecksum,
  buildIntegritySignature,
  checksumMatches,
  readProperty,
} from './signature';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

describe('buildIntegritySignature', () => {
  it('concatenates reference, amount, currency and the secret', () => {
    const signature = buildIntegritySignature({
      reference: 'TX-ABC',
      amountInCents: 47490000,
      currency: 'COP',
      integrityKey: 'secreto',
    });

    expect(signature).toBe(sha256('TX-ABC47490000COPsecreto'));
  });

  it('changes when the amount changes', () => {
    const base = { reference: 'TX-ABC', currency: 'COP', integrityKey: 'secreto' };

    expect(buildIntegritySignature({ ...base, amountInCents: 100 })).not.toBe(
      buildIntegritySignature({ ...base, amountInCents: 101 }),
    );
  });
});

describe('readProperty', () => {
  const data = {
    transaction: { id: 'gw-1', amount_in_cents: 1000, approved: true, nested: { a: 1 }, empty: null },
  };

  it('reads a nested string', () => {
    expect(readProperty(data, 'transaction.id')).toBe('gw-1');
  });

  it('stringifies a number', () => {
    expect(readProperty(data, 'transaction.amount_in_cents')).toBe('1000');
  });

  it('stringifies a boolean', () => {
    expect(readProperty(data, 'transaction.approved')).toBe('true');
  });

  it('returns an empty string for a missing path', () => {
    expect(readProperty(data, 'transaction.nope')).toBe('');
  });

  it('returns an empty string for a null value', () => {
    expect(readProperty(data, 'transaction.empty')).toBe('');
  });

  it('returns an empty string for an object value', () => {
    expect(readProperty(data, 'transaction.nested')).toBe('');
  });
});

describe('buildEventChecksum', () => {
  const data = { transaction: { id: 'gw-1', status: 'APPROVED', amount_in_cents: 47490000 } };

  it('hashes the listed properties followed by timestamp and secret', () => {
    const checksum = buildEventChecksum({
      data,
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      timestamp: 1530291411,
      eventsKey: 'eventos',
    });

    expect(checksum).toBe(sha256('gw-1APPROVED474900001530291411eventos'));
  });

  it('changes when a signed property is tampered with', () => {
    const options = {
      properties: ['transaction.status'],
      timestamp: 1530291411,
      eventsKey: 'eventos',
    };

    const original = buildEventChecksum({ ...options, data });
    const tampered = buildEventChecksum({
      ...options,
      data: { transaction: { ...data.transaction, status: 'DECLINED' } },
    });

    expect(original).not.toBe(tampered);
  });

  it('changes when the timestamp is replayed with another value', () => {
    const options = { data, properties: ['transaction.id'], eventsKey: 'eventos' };

    expect(buildEventChecksum({ ...options, timestamp: 1 })).not.toBe(
      buildEventChecksum({ ...options, timestamp: 2 }),
    );
  });
});

describe('checksumMatches', () => {
  const checksum = sha256('algo');

  it('accepts an identical checksum', () => {
    expect(checksumMatches(checksum, checksum)).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(checksumMatches(checksum, ` ${checksum.toUpperCase()} `)).toBe(true);
  });

  it('rejects a different checksum of the same length', () => {
    expect(checksumMatches(checksum, sha256('otra-cosa'))).toBe(false);
  });

  it('rejects a checksum of a different length', () => {
    expect(checksumMatches(checksum, 'corto')).toBe(false);
  });

  it('rejects an empty checksum', () => {
    expect(checksumMatches(checksum, '')).toBe(false);
  });
});
