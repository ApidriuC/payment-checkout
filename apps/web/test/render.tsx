import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import type { RootState } from '@/app/store';
import { catalogReducer } from '@/features/catalog/catalog.slice';
import { checkoutReducer } from '@/features/checkout/checkout.slice';
import { paymentReducer } from '@/features/payment/payment.slice';

const rootReducer = combineReducers({
  catalog: catalogReducer,
  checkout: checkoutReducer,
  payment: paymentReducer,
});

export const makeStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as never,
  });

export type TestStore = ReturnType<typeof makeStore>;

interface Options extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: TestStore;
  route?: string;
}

export const renderWithProviders = (ui: ReactElement, options: Options = {}) => {
  const { preloadedState, store = makeStore(preloadedState), route = '/', ...rest } = options;

  const Wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...rest }) };
};
