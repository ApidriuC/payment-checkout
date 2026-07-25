import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { CardBrandLogo } from '@/components/CardBrandLogo';
import { TextField } from '@/components/TextField';
import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  lastFourOf,
  onlyDigits,
  validateCard,
  type CardErrors,
  type CardInput,
} from '@/domain/card';
import { LEGAL_ID_TYPES, validateDelivery, type DeliveryErrors } from '@/domain/delivery';
import { loadProducts } from '@/features/catalog/catalog.slice';
import {
  deliveryChanged,
  detailsCompleted,
  steppedBack,
} from '@/features/checkout/checkout.slice';
import { payNow } from '@/features/payment/payment.slice';
import { SummaryBackdrop } from './SummaryBackdrop';

const EMPTY_CARD: CardInput = { number: '', holder: '', expiry: '', cvc: '' };

export function CheckoutPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { productId, quantity, delivery, step } = useAppSelector((state) => state.checkout);
  const products = useAppSelector((state) => state.catalog.products);
  const { status: paymentStatus, error: paymentError } = useAppSelector((state) => state.payment);

  const [card, setCard] = useState<CardInput>(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [installments, setInstallments] = useState(1);

  const product = useMemo(
    () => products.find((candidate) => candidate.id === productId),
    [products, productId],
  );

  const brand = detectBrand(card.number);

  useEffect(() => {
    if (!productId) {
      navigate('/', { replace: true });
      return;
    }
    if (products.length === 0) {
      void dispatch(loadProducts());
    }
  }, [dispatch, navigate, productId, products.length]);

  // The card never leaves this component, so a refresh at the summary step has
  // no card to show: send the buyer back to the form with their data intact.
  useEffect(() => {
    if (step === 'summary' && !card.number) {
      dispatch(steppedBack());
    }
  }, [step, card.number, dispatch]);

  const updateCard = (field: keyof CardInput, value: string) => {
    setCard((current) => ({ ...current, [field]: value }));
    setCardErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submitDetails = (event: React.FormEvent) => {
    event.preventDefault();

    const nextCardErrors = validateCard(card);
    const nextDeliveryErrors = validateDelivery(delivery);

    setCardErrors(nextCardErrors);
    setDeliveryErrors(nextDeliveryErrors);

    if (Object.keys(nextCardErrors).length > 0 || Object.keys(nextDeliveryErrors).length > 0) {
      return;
    }

    dispatch(
      detailsCompleted({
        card: { brand, lastFour: lastFourOf(card.number), holder: card.holder.trim() },
      }),
    );
  };

  const confirmPayment = async () => {
    if (!productId) return;

    const result = await dispatch(
      payNow({ productId, quantity, delivery, card, installments }),
    );

    if (payNow.fulfilled.match(result)) {
      setCard(EMPTY_CARD);
      navigate(`/result/${result.payload.reference}`);
    }
  };

  if (!product) {
    return (
      <section className="page" aria-busy="true">
        <p className="page__loading">Cargando el producto…</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <header className="modal__header">
          <h1 className="modal__title" id="checkout-title">
            Datos de pago y entrega
          </h1>
          <p className="modal__subtitle">
            {quantity} × {product.name}
          </p>
        </header>

        <form className="modal__body" onSubmit={submitDetails} noValidate>
          <fieldset className="fieldset">
            <legend className="fieldset__legend">Tarjeta de crédito</legend>

            <div className="card-number">
              <TextField
                label="Número de tarjeta"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                value={formatCardNumber(card.number)}
                error={cardErrors.number}
                onChange={(event) => updateCard('number', onlyDigits(event.target.value))}
              />
              <CardBrandLogo brand={brand} className="card-number__brand" />
            </div>

            <TextField
              label="Nombre en la tarjeta"
              autoComplete="cc-name"
              placeholder="ANA PEREZ"
              value={card.holder}
              error={cardErrors.holder}
              onChange={(event) => updateCard('holder', event.target.value)}
            />

            <div className="grid grid--two">
              <TextField
                label="Vencimiento"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                value={formatExpiry(card.expiry)}
                error={cardErrors.expiry}
                onChange={(event) => updateCard('expiry', onlyDigits(event.target.value))}
              />
              <TextField
                label="CVC"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                type="password"
                value={card.cvc}
                error={cardErrors.cvc}
                onChange={(event) => updateCard('cvc', onlyDigits(event.target.value).slice(0, 4))}
              />
            </div>

            <label className="field">
              <span className="field__label">Cuotas</span>
              <select
                className="field__input"
                value={installments}
                onChange={(event) => setInstallments(Number(event.target.value))}
              >
                {[1, 3, 6, 12, 24].map((value) => (
                  <option key={value} value={value}>
                    {value === 1 ? 'Una cuota' : `${value} cuotas`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset__legend">Datos de entrega</legend>

            <TextField
              label="Nombre completo"
              autoComplete="name"
              value={delivery.fullName}
              error={deliveryErrors.fullName}
              onChange={(event) => dispatch(deliveryChanged({ fullName: event.target.value }))}
            />

            <TextField
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              value={delivery.email}
              error={deliveryErrors.email}
              onChange={(event) => dispatch(deliveryChanged({ email: event.target.value }))}
            />

            <TextField
              label="Teléfono"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+57 300 111 2233"
              value={delivery.phoneNumber}
              error={deliveryErrors.phoneNumber}
              onChange={(event) => dispatch(deliveryChanged({ phoneNumber: event.target.value }))}
            />

            <div className="grid grid--two">
              <label className="field">
                <span className="field__label">Documento</span>
                <select
                  className="field__input"
                  value={delivery.legalIdType}
                  onChange={(event) =>
                    dispatch(deliveryChanged({ legalIdType: event.target.value }))
                  }
                >
                  {LEGAL_ID_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <TextField
                label="Número"
                inputMode="numeric"
                value={delivery.legalIdNumber}
                error={deliveryErrors.legalIdNumber}
                onChange={(event) =>
                  dispatch(deliveryChanged({ legalIdNumber: event.target.value }))
                }
              />
            </div>

            <TextField
              label="Dirección"
              autoComplete="address-line1"
              placeholder="Calle 123 # 45-67"
              value={delivery.addressLine1}
              error={deliveryErrors.addressLine1}
              onChange={(event) => dispatch(deliveryChanged({ addressLine1: event.target.value }))}
            />

            <TextField
              label="Apartamento, torre u oficina (opcional)"
              autoComplete="address-line2"
              value={delivery.addressLine2}
              onChange={(event) => dispatch(deliveryChanged({ addressLine2: event.target.value }))}
            />

            <div className="grid grid--two">
              <TextField
                label="Ciudad"
                autoComplete="address-level2"
                value={delivery.city}
                error={deliveryErrors.city}
                onChange={(event) => dispatch(deliveryChanged({ city: event.target.value }))}
              />
              <TextField
                label="Departamento"
                autoComplete="address-level1"
                value={delivery.region}
                error={deliveryErrors.region}
                onChange={(event) => dispatch(deliveryChanged({ region: event.target.value }))}
              />
            </div>
          </fieldset>

          <footer className="modal__footer">
            <button className="button" type="button" onClick={() => navigate('/')}>
              Cancelar
            </button>
            <button className="button button--primary" type="submit">
              Continuar
            </button>
          </footer>
        </form>
      </div>

      {step === 'summary' && card.number ? (
        <SummaryBackdrop
          product={product}
          quantity={quantity}
          card={{ brand, lastFour: lastFourOf(card.number) }}
          installments={installments}
          delivery={delivery}
          busy={paymentStatus === 'creating' || paymentStatus === 'paying'}
          error={paymentError}
          onBack={() => dispatch(steppedBack())}
          onConfirm={() => void confirmPayment()}
        />
      ) : null}
    </section>
  );
}
