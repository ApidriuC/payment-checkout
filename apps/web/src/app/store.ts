import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import { catalogReducer } from '@/features/catalog/catalog.slice';
import { checkoutReducer } from '@/features/checkout/checkout.slice';
import { paymentReducer } from '@/features/payment/payment.slice';

const rootReducer = combineReducers({
  catalog: catalogReducer,
  checkout: checkoutReducer,
  payment: paymentReducer,
});

// The catalog is refetched on every visit, so only the checkout progress and the
// transaction result survive a refresh. Card secrets are never in the store.
const persistConfig = {
  key: 'checkout',
  version: 1,
  storage,
  whitelist: ['checkout', 'payment'],
};

export const setupStore = () =>
  configureStore({
    reducer: persistReducer(persistConfig, rootReducer),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });

export const store = setupStore();
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];
