import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { type ReferenceGenerator } from '@/contexts/payments/domain/ports/reference-generator.port';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class PrefixedReferenceGenerator implements ReferenceGenerator {
  generate(): string {
    const suffix = Array.from(randomBytes(10))
      .map((byte) => ALPHABET[byte % ALPHABET.length])
      .join('');

    return `TX-${Date.now().toString(36).toUpperCase()}-${suffix}`;
  }
}
