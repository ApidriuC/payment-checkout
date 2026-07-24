export const REFERENCE_GENERATOR = Symbol('ReferenceGenerator');

export interface ReferenceGenerator {
  generate(): string;
}
