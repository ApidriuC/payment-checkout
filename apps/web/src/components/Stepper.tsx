import type { CheckoutStep } from '@/features/checkout/checkout.slice';

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 'product', label: 'Producto' },
  { id: 'details', label: 'Datos' },
  { id: 'summary', label: 'Resumen' },
  { id: 'result', label: 'Resultado' },
];

interface Props {
  current: CheckoutStep;
}

export function Stepper({ current }: Props) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="stepper" aria-label="Progreso del checkout">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';

        return (
          <li key={step.id} className={`stepper__item stepper__item--${state}`}>
            <span className="stepper__dot" aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className="stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
