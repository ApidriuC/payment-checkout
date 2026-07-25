import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { CardBrand } from '@/domain/card';
import { EMPTY_DELIVERY, type DeliveryInput } from '@/domain/delivery';

export type CheckoutStep = 'product' | 'details' | 'summary' | 'result';

/**
 * Only non-sensitive card data is kept in the store. The number, expiry and CVC
 * live in the form component and are discarded the moment the card is tokenized,
 * so a persisted state can never leak them.
 */
export interface CardPreview {
  brand: CardBrand;
  lastFour: string;
  holder: string;
}

export interface CheckoutState {
  step: CheckoutStep;
  productId: string | null;
  quantity: number;
  delivery: DeliveryInput;
  card: CardPreview | null;
  reference: string | null;
}

export const initialCheckoutState: CheckoutState = {
  step: 'product',
  productId: null,
  quantity: 1,
  delivery: EMPTY_DELIVERY,
  card: null,
  reference: null,
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    checkoutStarted(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      state.productId = action.payload.productId;
      state.quantity = action.payload.quantity;
      state.step = 'details';
      state.reference = null;
    },
    quantityChanged(state, action: PayloadAction<number>) {
      state.quantity = Math.max(1, action.payload);
    },
    deliveryChanged(state, action: PayloadAction<Partial<DeliveryInput>>) {
      state.delivery = { ...state.delivery, ...action.payload };
    },
    detailsCompleted(state, action: PayloadAction<{ card: CardPreview }>) {
      state.card = action.payload.card;
      state.step = 'summary';
    },
    referenceCreated(state, action: PayloadAction<string>) {
      state.reference = action.payload;
    },
    resultReached(state) {
      state.step = 'result';
    },
    steppedBack(state) {
      if (state.step === 'summary') state.step = 'details';
      else if (state.step === 'details') state.step = 'product';
    },
    checkoutReset() {
      return initialCheckoutState;
    },
  },
});

export const {
  checkoutStarted,
  quantityChanged,
  deliveryChanged,
  detailsCompleted,
  referenceCreated,
  resultReached,
  steppedBack,
  checkoutReset,
} = checkoutSlice.actions;

export const checkoutReducer = checkoutSlice.reducer;
