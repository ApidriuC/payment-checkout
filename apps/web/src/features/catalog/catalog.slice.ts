import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { api, toApiError } from '@/api/client';
import type { Product } from '@/api/types';

export interface CatalogState {
  products: Product[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
}

export const initialCatalogState: CatalogState = {
  products: [],
  status: 'idle',
  error: null,
};

export const loadProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  'catalog/loadProducts',
  async (_, { rejectWithValue }) => {
    try {
      return await api.listProducts();
    } catch (cause) {
      return rejectWithValue(toApiError(cause).message);
    }
  },
);

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: initialCatalogState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.status = 'ready';
        state.products = action.payload;
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'No pudimos cargar los productos.';
      });
  },
});

export const catalogReducer = catalogSlice.reducer;
