import { type ValueTransformer } from 'typeorm';

// The pg driver returns BIGINT as a string to avoid precision loss; cent amounts
// stay well inside Number.MAX_SAFE_INTEGER, so reading them back as numbers is safe.
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
