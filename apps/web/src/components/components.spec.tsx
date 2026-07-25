import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { formatCents } from '@/lib/money';

import { CardBrandLogo } from './CardBrandLogo';
import { Stepper } from './Stepper';
import { TextField } from './TextField';

describe('CardBrandLogo', () => {
  it('renders the Visa mark', () => {
    render(<CardBrandLogo brand="VISA" />);

    expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument();
  });

  it('renders the Mastercard mark', () => {
    render(<CardBrandLogo brand="MASTERCARD" />);

    expect(screen.getByRole('img', { name: 'Mastercard' })).toBeInTheDocument();
  });

  it('renders nothing for an unknown brand', () => {
    const { container } = render(<CardBrandLogo brand="UNKNOWN" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Stepper', () => {
  it('lists the four steps of the process', () => {
    render(<Stepper current="product" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('marks the current step', () => {
    render(<Stepper current="summary" />);

    const items = screen.getAllByRole('listitem');
    expect(items[2].className).toContain('stepper__item--current');
  });

  it('marks the steps already completed', () => {
    render(<Stepper current="result" />);

    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('stepper__item--done');
    expect(items[1].className).toContain('stepper__item--done');
  });

  it('leaves the upcoming steps pending', () => {
    render(<Stepper current="product" />);

    expect(screen.getAllByRole('listitem')[3].className).toContain('stepper__item--todo');
  });
});

describe('TextField', () => {
  it('links the label to the input', async () => {
    const user = userEvent.setup();
    render(<TextField label="Ciudad" />);

    await user.type(screen.getByLabelText('Ciudad'), 'Medellín');

    expect(screen.getByLabelText('Ciudad')).toHaveValue('Medellín');
  });

  it('announces the error to assistive technology', () => {
    render(<TextField label="Ciudad" error="Ingresa la ciudad." />);

    const input = screen.getByLabelText('Ciudad');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa la ciudad.');
    expect(input).toHaveAccessibleDescription('Ingresa la ciudad.');
  });

  it('shows the hint when there is no error', () => {
    render(<TextField label="Ciudad" hint="Donde recibirás el pedido." />);

    expect(screen.getByLabelText('Ciudad')).toHaveAccessibleDescription(
      'Donde recibirás el pedido.',
    );
  });

  it('prefers the error over the hint', () => {
    render(<TextField label="Ciudad" hint="Una pista" error="Un error" />);

    expect(screen.queryByText('Una pista')).not.toBeInTheDocument();
    expect(screen.getByText('Un error')).toBeInTheDocument();
  });
});

describe('formatCents', () => {
  it('formats an amount in Colombian pesos without decimals', () => {
    expect(formatCents(45990000)).toMatch(/459\.900/);
  });

  it('formats zero', () => {
    expect(formatCents(0)).toMatch(/0/);
  });

  it('rounds to the nearest peso', () => {
    expect(formatCents(150)).toMatch(/2/);
  });
});
