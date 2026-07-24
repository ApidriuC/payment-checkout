import { DomainError, DomainErrorKind } from '@/shared/domain/domain-error';
import { type Money } from '@/shared/domain/money';
import { err, map, ok, type Result } from '@/shared/domain/result';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

const ALLOWED_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.SHIPPED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.SHIPPED]: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.CANCELLED]: [],
};

export class InvalidDeliveryTransitionError extends DomainError {
  readonly code = 'INVALID_DELIVERY_TRANSITION';
  readonly kind = DomainErrorKind.Conflict;

  constructor(from: DeliveryStatus, to: DeliveryStatus) {
    super('La entrega no puede pasar a ese estado desde su estado actual.', { from, to });
  }
}

export class InvalidDeliveryAddressError extends DomainError {
  readonly code = 'INVALID_DELIVERY_ADDRESS';
  readonly kind = DomainErrorKind.Validation;

  constructor(field: string) {
    super('La dirección de entrega está incompleta o es inválida.', { field });
  }
}

export class DeliveryNotFoundError extends DomainError {
  readonly code = 'DELIVERY_NOT_FOUND';
  readonly kind = DomainErrorKind.NotFound;

  constructor(transactionReference: string) {
    super('No existe una entrega asociada a esa transacción.', { transactionReference });
  }
}

export interface DeliveryAddressInput {
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  country?: string;
  postalCode?: string | null;
}

export class DeliveryAddress {
  private constructor(
    readonly recipientName: string,
    readonly recipientPhone: string,
    readonly addressLine1: string,
    readonly addressLine2: string | null,
    readonly city: string,
    readonly region: string,
    readonly country: string,
    readonly postalCode: string | null,
  ) {}

  static create(input: DeliveryAddressInput): Result<DeliveryAddress, DomainError> {
    const required: Array<[string, string]> = [
      ['recipientName', input.recipientName],
      ['recipientPhone', input.recipientPhone],
      ['addressLine1', input.addressLine1],
      ['city', input.city],
      ['region', input.region],
    ];

    for (const [field, value] of required) {
      if (!value || value.trim().length < 2) {
        return err(new InvalidDeliveryAddressError(field));
      }
    }

    const country = (input.country ?? 'CO').trim().toUpperCase();

    if (country.length !== 2) {
      return err(new InvalidDeliveryAddressError('country'));
    }

    return ok(
      new DeliveryAddress(
        input.recipientName.trim(),
        input.recipientPhone.trim(),
        input.addressLine1.trim(),
        input.addressLine2?.trim() || null,
        input.city.trim(),
        input.region.trim(),
        country,
        input.postalCode?.trim() || null,
      ),
    );
  }
}

export interface NewDelivery {
  id: string;
  transactionId: string;
  customerId: string;
  address: DeliveryAddress;
  fee: Money;
}

export interface DeliverySnapshot {
  id: string;
  transactionId: string;
  customerId: string;
  status: DeliveryStatus;
  address: DeliveryAddressInput;
  deliveryFeeInCents: number;
  trackingCode: string | null;
  assignedAt: Date | null;
}

interface DeliveryProps extends NewDelivery {
  status: DeliveryStatus;
  trackingCode: string | null;
  assignedAt: Date | null;
}

export class Delivery {
  private constructor(private readonly props: DeliveryProps) {}

  static create(input: NewDelivery): Delivery {
    return new Delivery({
      ...input,
      status: DeliveryStatus.PENDING,
      trackingCode: null,
      assignedAt: null,
    });
  }

  static rehydrate(
    snapshot: DeliverySnapshot,
    fee: Money,
  ): Result<Delivery, DomainError> {
    return map(
      DeliveryAddress.create(snapshot.address),
      (address) =>
        new Delivery({
          id: snapshot.id,
          transactionId: snapshot.transactionId,
          customerId: snapshot.customerId,
          address,
          fee,
          status: snapshot.status,
          trackingCode: snapshot.trackingCode,
          assignedAt: snapshot.assignedAt,
        }),
    );
  }

  get id(): string {
    return this.props.id;
  }

  get transactionId(): string {
    return this.props.transactionId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get status(): DeliveryStatus {
    return this.props.status;
  }

  get address(): DeliveryAddress {
    return this.props.address;
  }

  get fee(): Money {
    return this.props.fee;
  }

  get trackingCode(): string | null {
    return this.props.trackingCode;
  }

  get assignedAt(): Date | null {
    return this.props.assignedAt;
  }

  /** Called once the payment is approved: the product is now committed to this customer. */
  assign(trackingCode: string, at: Date): Result<Delivery, DomainError> {
    return this.transitionTo(DeliveryStatus.ASSIGNED, (props) => ({
      ...props,
      trackingCode,
      assignedAt: at,
    }));
  }

  cancel(): Result<Delivery, DomainError> {
    return this.transitionTo(DeliveryStatus.CANCELLED, (props) => props);
  }

  markAs(status: DeliveryStatus): Result<Delivery, DomainError> {
    return this.transitionTo(status, (props) => props);
  }

  toSnapshot(): DeliverySnapshot {
    return {
      id: this.props.id,
      transactionId: this.props.transactionId,
      customerId: this.props.customerId,
      status: this.props.status,
      address: {
        recipientName: this.props.address.recipientName,
        recipientPhone: this.props.address.recipientPhone,
        addressLine1: this.props.address.addressLine1,
        addressLine2: this.props.address.addressLine2,
        city: this.props.address.city,
        region: this.props.address.region,
        country: this.props.address.country,
        postalCode: this.props.address.postalCode,
      },
      deliveryFeeInCents: this.props.fee.amountInCents,
      trackingCode: this.props.trackingCode,
      assignedAt: this.props.assignedAt,
    };
  }

  private transitionTo(
    status: DeliveryStatus,
    decorate: (props: DeliveryProps) => DeliveryProps,
  ): Result<Delivery, DomainError> {
    if (!ALLOWED_TRANSITIONS[this.props.status].includes(status)) {
      return err(new InvalidDeliveryTransitionError(this.props.status, status));
    }

    return ok(new Delivery(decorate({ ...this.props, status })));
  }
}
