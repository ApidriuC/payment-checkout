import { useEffect, useState } from 'react';

import { api } from '@/api/client';
import type { Product } from '@/api/types';
import { CardBrandLogo } from '@/components/CardBrandLogo';
import type { CardBrand } from '@/domain/card';
import type { DeliveryInput } from '@/domain/delivery';
import { formatCents } from '@/lib/money';

interface Props {
  product: Product;
  quantity: number;
  card: { brand: CardBrand; lastFour: string };
  installments: number;
  delivery: DeliveryInput;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

export function SummaryBackdrop({
  product,
  quantity,
  card,
  installments,
  delivery,
  busy,
  error,
  onBack,
  onConfirm,
}: Props) {
  const [fees, setFees] = useState<{ base: number; delivery: number } | null>(null);

  useEffect(() => {
    let active = true;

    api
      .getCheckoutConfig()
      .then((config) => {
        if (active) {
          setFees({ base: config.baseFeeInCents, delivery: config.deliveryFeeInCents });
        }
      })
      .catch(() => {
        if (active) setFees(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const productAmount = product.priceInCents * quantity;
  const total = fees ? productAmount + fees.base + fees.delivery : null;

  return (
    <div className="backdrop" data-testid="summary-backdrop">
      <div className="backdrop__back" aria-hidden="true" />

      <section
        className="backdrop__front"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
      >
        <div className="backdrop__handle" aria-hidden="true" />

        <h2 className="backdrop__title" id="summary-title">
          Resumen del pago
        </h2>

        <dl className="summary">
          <div className="summary__row">
            <dt>
              {quantity} × {product.name}
            </dt>
            <dd>{formatCents(productAmount)}</dd>
          </div>

          <div className="summary__row">
            <dt>Comisión base</dt>
            <dd>{fees ? formatCents(fees.base) : '—'}</dd>
          </div>

          <div className="summary__row">
            <dt>Envío</dt>
            <dd>{fees ? formatCents(fees.delivery) : '—'}</dd>
          </div>

          <div className="summary__row summary__row--total">
            <dt>Total a pagar</dt>
            <dd data-testid="summary-total">{total !== null ? formatCents(total) : '—'}</dd>
          </div>
        </dl>

        <div className="summary__meta">
          <p className="summary__card">
            <CardBrandLogo brand={card.brand} className="summary__brand" />
            <span>
              •••• {card.lastFour} · {installments === 1 ? 'una cuota' : `${installments} cuotas`}
            </span>
          </p>
          <p className="summary__address">
            Entrega en {delivery.addressLine1}, {delivery.city}, {delivery.region}
          </p>
        </div>

        {error ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="backdrop__actions">
          <button className="button" type="button" onClick={onBack} disabled={busy}>
            Volver
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={onConfirm}
            disabled={busy || total === null}
          >
            {busy ? 'Procesando…' : `Pagar ${total !== null ? formatCents(total) : ''}`}
          </button>
        </div>
      </section>
    </div>
  );
}
