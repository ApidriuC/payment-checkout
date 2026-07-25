import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadProducts } from '@/features/catalog/catalog.slice';
import { checkoutStarted } from '@/features/checkout/checkout.slice';
import { paymentReset } from '@/features/payment/payment.slice';
import { formatCents } from '@/lib/money';

export function ProductPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { products, status, error } = useAppSelector((state) => state.catalog);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    void dispatch(loadProducts());
  }, [dispatch]);

  const buy = (productId: string) => {
    dispatch(paymentReset());
    dispatch(checkoutStarted({ productId, quantity: quantities[productId] ?? 1 }));
    navigate('/checkout');
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="page" aria-busy="true">
        <p className="page__loading">Cargando productos…</p>
      </section>
    );
  }

  if (status === 'failed') {
    return (
      <section className="page">
        <p className="alert alert--error" role="alert">
          {error}
        </p>
        <button className="button" type="button" onClick={() => void dispatch(loadProducts())}>
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Tecnología para tu escritorio</h1>
        <p className="page__subtitle">Envíos a todo el país. Paga con tarjeta de crédito.</p>
      </header>

      <ul className="product-grid">
        {products.map((product) => {
          const soldOut = product.availableUnits === 0;
          const quantity = quantities[product.id] ?? 1;
          const max = Math.min(product.availableUnits, 20);

          return (
            <li className="product-card" key={product.id}>
              <div className="product-card__media">
                <img
                  className="product-card__image"
                  src={product.imageUrl}
                  alt={product.name}
                  width={320}
                  height={220}
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="product-card__body">
                <h2 className="product-card__name">{product.name}</h2>
                <p className="product-card__description">{product.description}</p>

                <p className="product-card__price">{formatCents(product.priceInCents)}</p>

                <p
                  className={`product-card__stock ${soldOut ? 'product-card__stock--out' : ''}`}
                  data-testid={`stock-${product.sku}`}
                >
                  {soldOut
                    ? 'Agotado'
                    : `${product.availableUnits} ${product.availableUnits === 1 ? 'unidad disponible' : 'unidades disponibles'}`}
                </p>

                <div className="product-card__actions">
                  <label className="quantity">
                    <span className="quantity__label">Cantidad</span>
                    <select
                      className="quantity__select"
                      value={quantity}
                      disabled={soldOut}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [product.id]: Number(event.target.value),
                        }))
                      }
                    >
                      {Array.from({ length: Math.max(max, 1) }, (_, index) => index + 1).map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    className="button button--primary"
                    type="button"
                    disabled={soldOut}
                    onClick={() => buy(product.id)}
                  >
                    Pagar con tarjeta
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
