import axios, { isAxiosError } from 'axios';

import { onlyDigits, parseExpiry, type CardInput } from '@/domain/card';

import { ApiError, toApiError } from './client';
import type { CheckoutConfig } from './types';

interface GatewayValidationError {
  error?: {
    type?: string;
    reason?: string;
    messages?: Record<string, string[]>;
  };
}

/**
 * The gateway reports validation problems in its own shape, with one list of
 * messages per rejected field. Surfacing the first one tells the buyer what to
 * fix instead of a generic failure.
 */
const toTokenizationError = (cause: unknown): ApiError => {
  if (!isAxiosError(cause)) {
    return toApiError(cause);
  }

  const body = cause.response?.data as GatewayValidationError | undefined;
  const firstMessage = Object.values(body?.error?.messages ?? {})
    .flat()
    .find((message) => typeof message === 'string' && message.length > 0);

  const detail = firstMessage ?? body?.error?.reason;

  if (detail) {
    return new ApiError(
      body?.error?.type ?? 'CARD_REJECTED',
      detail,
      cause.response?.status ?? 422,
    );
  }

  return toApiError(cause);
};

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
    throw toTokenizationError(cause);
  }
};
