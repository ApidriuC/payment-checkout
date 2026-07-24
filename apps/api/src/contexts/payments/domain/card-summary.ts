import { type DomainError } from '@/shared/domain/domain-error';
import { err, ok, type Result } from '@/shared/domain/result';

import { InvalidCardSummaryError } from './errors';

export enum CardBrand {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  UNKNOWN = 'UNKNOWN',
}

const LAST_FOUR_PATTERN = /^\d{4}$/;

const BRAND_ALIASES: Record<string, CardBrand> = {
  VISA: CardBrand.VISA,
  MASTERCARD: CardBrand.MASTERCARD,
  'MASTER CARD': CardBrand.MASTERCARD,
};

/**
 * Everything the platform is allowed to keep about a card: the brand and the
 * last four digits. The PAN, expiry and CVC never reach this service.
 */
export class CardSummary {
  private constructor(
    readonly brand: CardBrand,
    readonly lastFour: string,
  ) {}

  static create(rawBrand: string, lastFour: string): Result<CardSummary, DomainError> {
    if (!LAST_FOUR_PATTERN.test(lastFour)) {
      return err(new InvalidCardSummaryError());
    }

    return ok(new CardSummary(CardSummary.normalizeBrand(rawBrand), lastFour));
  }

  private static normalizeBrand(rawBrand: string): CardBrand {
    return BRAND_ALIASES[rawBrand.trim().toUpperCase()] ?? CardBrand.UNKNOWN;
  }
}
