import axios from 'axios';

import { onlyDigits, parseExpiry, type CardInput } from '@/domain/card';

import { toApiError } from './client';
import type { CheckoutConfig } from './types';

export interface CardToken {
  token: string;
  brand: string;
  lastFour: string;
}

interface TokenizeResponse {
  status: string;
  data: { id: string; brand: string; last_four: string };
}

/**
 * The card is tokenized straight against the gateway with the public key, so the
 * PAN, expiry and CVC never travel to our own backend.
 */
export const tokenizeCard = async (card: CardInput, config: CheckoutConfig): Promise<CardToken> => {
  const expiry = parseExpiry(card.expiry);

  if (!expiry) {
    throw new Error('La fecha de expiración no es válida.');
  }

  try {
    const { data } = await axios.post<TokenizeResponse>(
      config.tokenizationUrl,
      {
        number: onlyDigits(card.number),
        cvc: onlyDigits(card.cvc),
        exp_month: String(expiry.month).padStart(2, '0'),
        exp_year: String(expiry.year).slice(-2),
        card_holder: card.holder.trim(),
      },
      {
        headers: {
          Authorization: `Bearer ${config.publicKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    return {
      token: data.data.id,
      brand: data.data.brand?.toUpperCase() ?? 'UNKNOWN',
      lastFour: data.data.last_four,
    };
  } catch (cause) {
    throw toApiError(cause);
  }
};
