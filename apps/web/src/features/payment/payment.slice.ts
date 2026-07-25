import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { api, toApiError } from '@/api/client';
import { tokenizeCard } from '@/api/tokenize-card';
import type { CreateTransactionPayload, Transaction } from '@/api/types';
import type { CardInput } from '@/domain/card';
import type { DeliveryInput } from '@/domain/delivery';

export interface PaymentState {
  status: 'idle' | 'creating' | 'paying' | 'polling' | 'settled' | 'failed';
  transaction: Transaction | null;
  error: string | null;
}

export const initialPaymentState: PaymentState = {
  status: 'idle',
  transaction: null,
  error: null,
};

export const toCreatePayload = (
  productId: string,
  quantity: number,
  delivery: DeliveryInput,
): CreateTransactionPayload => ({
  productId,
  quantity,
  customer: {
    email: delivery.email.trim(),
    fullName: delivery.fullName.trim(),
    phoneNumber: delivery.phoneNumber.trim(),
    ...(delivery.legalIdNumber.trim()
      ? { legalIdType: delivery.legalIdType, legalIdNumber: delivery.legalIdNumber.trim() }
      : {}),
  },
  delivery: {
    recipientName: delivery.fullName.trim(),
    recipientPhone: delivery.phoneNumber.trim(),
    addressLine1: delivery.addressLine1.trim(),
    ...(delivery.addressLine2.trim() ? { addressLine2: delivery.addressLine2.trim() } : {}),
    city: delivery.city.trim(),
    region: delivery.region.trim(),
    country: 'CO',
    ...(delivery.postalCode.trim() ? { postalCode: delivery.postalCode.trim() } : {}),
  },
});

export interface PayNowArgs {
  productId: string;
  quantity: number;
  delivery: DeliveryInput;
  card: CardInput;
  installments: number;
}

/**
 * Runs the three steps the checkout needs in order: register a pending
 * transaction, tokenize the card against the gateway, then send the token to be
 * charged. Each step surfaces its own error message.
 */
export const payNow = createAsyncThunk<Transaction, PayNowArgs, { rejectValue: string }>(
  'payment/payNow',
  async (args, { rejectWithValue, dispatch }) => {
    let reference: string;

    try {
      const created = await api.createTransaction(
        toCreatePayload(args.productId, args.quantity, args.delivery),
      );
      reference = created.reference;
      dispatch(transactionCreated(created));
    } catch (cause) {
      return rejectWithValue(toApiError(cause).message);
    }

    try {
      const config = await api.getCheckoutConfig();
      const token = await tokenizeCard(args.card, config);

      return await api.payTransaction(reference, {
        cardToken: token.token,
        acceptanceToken: config.acceptanceToken,
        ...(config.personalDataAuthToken
          ? { personalDataAuthToken: config.personalDataAuthToken }
          : {}),
        installments: args.installments,
        cardBrand: token.brand,
        cardLastFour: token.lastFour,
      });
    } catch (cause) {
      return rejectWithValue(toApiError(cause).message);
    }
  },
);

export const refreshTransaction = createAsyncThunk<Transaction, string, { rejectValue: string }>(
  'payment/refreshTransaction',
  async (reference, { rejectWithValue }) => {
    try {
      return await api.getTransaction(reference);
    } catch (cause) {
      return rejectWithValue(toApiError(cause).message);
    }
  },
);

const paymentSlice = createSlice({
  name: 'payment',
  initialState: initialPaymentState,
  reducers: {
    transactionCreated(state, action: { payload: Transaction }) {
      state.transaction = action.payload;
      state.status = 'paying';
    },
    paymentReset() {
      return initialPaymentState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(payNow.pending, (state) => {
        state.status = 'creating';
        state.error = null;
      })
      .addCase(payNow.fulfilled, (state, action) => {
        state.status = action.payload.status === 'PENDING' ? 'polling' : 'settled';
        state.transaction = action.payload;
      })
      .addCase(payNow.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'No pudimos procesar el pago.';
      })
      .addCase(refreshTransaction.fulfilled, (state, action) => {
        state.transaction = action.payload;
        state.status = action.payload.status === 'PENDING' ? 'polling' : 'settled';
      })
      .addCase(refreshTransaction.rejected, (state, action) => {
        state.error = action.payload ?? 'No pudimos consultar la transacción.';
      });
  },
});

export const { transactionCreated, paymentReset } = paymentSlice.actions;

export const paymentReducer = paymentSlice.reducer;
