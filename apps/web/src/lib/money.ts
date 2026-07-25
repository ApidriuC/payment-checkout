const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export const formatCents = (amountInCents: number): string =>
  formatter.format(Math.round(amountInCents / 100));
