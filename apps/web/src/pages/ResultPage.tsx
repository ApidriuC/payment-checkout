import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { TransactionStatus } from '@/api/types';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadProducts } from '@/features/catalog/catalog.slice';
import { checkoutReset, resultReached } from '@/features/checkout/checkout.slice';
import { paymentReset, refreshTransaction } from '@/features/payment/payment.slice';
import { formatCents } from '@/lib/money';

const POLL_INTERVAL_MS = 3000;

const OUTCOMES: Record<TransactionStatus, { title: string; message: string; tone: string }> = {
  PENDING: {
    title: 'Estamos procesando tu pago',
    message: 'Esto puede tardar unos segundos. No cierres esta página.',
    tone: 'pending',
  },
  APPROVED: {
    title: '¡Pago aprobado!',
    message: 'Tu producto quedó asignado y lo enviaremos a la dirección indicada.',
    tone: 'approved',
  },
  DECLINED: {
    title: 'Pago rechazado',
    message: 'Tu banco no autorizó la transacción. Puedes intentar con otra tarjeta.',
    tone: 'declined',
  },
  VOIDED: {
    title: 'Pago anulado',
    message: 'La transacción fue anulada y las unidades volvieron al inventario.',
    tone: 'declined',
  },
  ERROR: {
    title: 'No pudimos completar el pago',
    message: 'Ocurrió un problema al procesar la transacción. No se realizó ningún cobro.',
    tone: 'declined',
  },
};

export function ResultPage() {
  const { reference } = useParams<{ reference: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { transaction, error } = useAppSelector((state) => state.payment);

  useEffect(() => {
    dispatch(resultReached());
  }, [dispatch]);

  // Reloading this URL rebuilds the whole result from the backend, so the buyer
  // never loses the outcome of a payment they already made.
  useEffect(() => {
    if (reference) {
      void dispatch(refreshTransaction(reference));
    }
  }, [dispatch, reference]);

  const status = transaction?.status;

  useEffect(() => {
    if (!reference || status !== 'PENDING') return undefined;

    const timer = setInterval(() => {
      void dispatch(refreshTransaction(reference));
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [dispatch, reference, status]);

  const backToStore = () => {
    dispatch(checkoutReset());
    dispatch(paymentReset());
    void dispatch(loadProducts());
    navigate('/', { replace: true });
  };

  if (!transaction) {
    return (
      <section className="page" aria-busy="true">
        <p className="page__loading">Consultando tu transacción…</p>
        {error ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const outcome = OUTCOMES[transaction.status];

  return (
    <section className="page">
      <div className={`result result--${outcome.tone}`}>
        <div className="result__icon" aria-hidden="true">
          {transaction.status === 'APPROVED' ? '✓' : transaction.status === 'PENDING' ? '⏳' : '✕'}
        </div>

        <h1 className="result__title">{outcome.title}</h1>
        <p className="result__message">{outcome.message}</p>

        {transaction.failureReason ? (
          <p className="result__reason">{transaction.failureReason}</p>
        ) : null}

        <dl className="result__details">
          <div className="result__row">
            <dt>Número de transacción</dt>
            <dd data-testid="result-reference">{transaction.reference}</dd>
          </div>
          <div className="result__row">
            <dt>Total</dt>
            <dd>{formatCents(transaction.amounts.totalInCents)}</dd>
          </div>
          {transaction.cardLastFour ? (
            <div className="result__row">
              <dt>Tarjeta</dt>
              <dd>
                {transaction.cardBrand} •••• {transaction.cardLastFour}
              </dd>
            </div>
          ) : null}
        </dl>

        <button className="button button--primary" type="button" onClick={backToStore}>
          Volver a la tienda
        </button>
      </div>
    </section>
  );
}
