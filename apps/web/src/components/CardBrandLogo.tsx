import type { CardBrand } from '@/domain/card';

interface Props {
  brand: CardBrand;
  className?: string;
}

export function CardBrandLogo({ brand, className }: Props) {
  if (brand === 'VISA') {
    return (
      <svg
        className={className}
        viewBox="0 0 48 16"
        role="img"
        aria-label="Visa"
        data-testid="brand-visa"
      >
        <text
          x="0"
          y="13"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="15"
          fontWeight="700"
          fontStyle="italic"
          letterSpacing="1"
          fill="#1434CB"
        >
          VISA
        </text>
      </svg>
    );
  }

  if (brand === 'MASTERCARD') {
    return (
      <svg
        className={className}
        viewBox="0 0 48 16"
        role="img"
        aria-label="Mastercard"
        data-testid="brand-mastercard"
      >
        <circle cx="18" cy="8" r="7" fill="#EB001B" />
        <circle cx="28" cy="8" r="7" fill="#F79E1B" />
        <path
          d="M23 2.6a7 7 0 0 0 0 10.8 7 7 0 0 0 0-10.8Z"
          fill="#FF5F00"
        />
      </svg>
    );
  }

  return null;
}
