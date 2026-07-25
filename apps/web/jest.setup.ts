import { TextDecoder, TextEncoder } from 'node:util';

import '@testing-library/jest-dom';

// jsdom ships without the text encoding globals that react-router expects.
Object.assign(globalThis, { TextEncoder, TextDecoder, __API_BASE_URL__: '/api/v1' });

// jsdom does not implement matchMedia, which the responsive layout hook reads.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

Object.defineProperty(window, 'scrollTo', { writable: true, value: jest.fn() });
