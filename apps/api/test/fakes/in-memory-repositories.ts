import { InsufficientStockError, ProductNotFoundError, StockNotFoundError } from '@/contexts/catalog/domain/errors';
import { type ProductRepository } from '@/contexts/catalog/domain/ports/product.repository';
import { Product, type ProductSnapshot } from '@/contexts/catalog/domain/product';
import { type Stock } from '@/contexts/catalog/domain/stock';
import { type Customer } from '@/contexts/customers/domain/customer';
import { CustomerNotFoundError } from '@/contexts/customers/domain/errors';
import { type CustomerRepository } from '@/contexts/customers/domain/ports/customer.repository';
import { type Delivery, DeliveryNotFoundError } from '@/contexts/deliveries/domain/delivery';
import { type DeliveryRepository } from '@/contexts/deliveries/domain/ports/delivery.repository';
import { TransactionNotFoundError } from '@/contexts/payments/domain/errors';
import { type PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import {
  type TransactionEventRecord,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { type Clock } from '@/shared/application/ports/clock.port';
import { type IdGenerator } from '@/shared/application/ports/id-generator.port';
import {
  type TransactionContext,
  type UnitOfWork,
} from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, ok, okVoid } from '@/shared/domain/result';

export const FAKE_CONTEXT = {} as TransactionContext;

export class FakeUnitOfWork implements UnitOfWork {
  rollbacks = 0;

  async run<T>(
    work: (context: TransactionContext) => AsyncResult<T, DomainError>,
  ): AsyncResult<T, DomainError> {
    const result = await work(FAKE_CONTEXT);
    if (!result.ok) {
      this.rollbacks += 1;
    }
    return result;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly value: Date) {}

  now(): Date {
    return this.value;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = 'id') {}

  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}

export const productSnapshot = (overrides: Partial<ProductSnapshot> = {}): ProductSnapshot => ({
  id: 'product-1',
  sku: 'AUD-ORBIT-01',
  name: 'Audífonos Orbit Pro',
  description: 'Audífonos over-ear.',
  priceInCents: 45990000,
  currency: 'COP',
  imageUrl: '/images/products/orbit-headphones.svg',
  stock: { availableUnits: 12, reservedUnits: 0, version: 1 },
  ...overrides,
});

export const buildProduct = (overrides: Partial<ProductSnapshot> = {}): Product => {
  const result = Product.rehydrate(productSnapshot(overrides));
  if (!result.ok) throw new Error('invalid product fixture');
  return result.value;
};

export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();
  private readonly stocks = new Map<string, Stock>();

  saveStockCalls = 0;
  failNextStockSave = false;

  add(product: Product): void {
    this.products.set(product.id, product);
    this.stocks.set(product.id, product.stock);
  }

  currentStock(productId: string): Stock | undefined {
    return this.stocks.get(productId);
  }

  findAll(): AsyncResult<Product[], DomainError> {
    return Promise.resolve(ok([...this.products.values()]));
  }

  findById(id: string): AsyncResult<Product, DomainError> {
    const product = this.products.get(id);
    return Promise.resolve(product ? ok(product) : err(new ProductNotFoundError(id)));
  }

  findStockByProductId(productId: string): AsyncResult<Stock, DomainError> {
    const stock = this.stocks.get(productId);
    return Promise.resolve(stock ? ok(stock) : err(new StockNotFoundError(productId)));
  }

  lockStockByProductId(productId: string): AsyncResult<Stock, DomainError> {
    return this.findStockByProductId(productId);
  }

  saveStock(stock: Stock): AsyncResult<Stock, DomainError> {
    this.saveStockCalls += 1;

    if (this.failNextStockSave) {
      this.failNextStockSave = false;
      return Promise.resolve(err(new InsufficientStockError(stock.productId, 0, 0)));
    }

    this.stocks.set(stock.productId, stock);
    return Promise.resolve(ok(stock));
  }
}

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly byId = new Map<string, Customer>();

  add(customer: Customer): void {
    this.byId.set(customer.id, customer);
  }

  findById(id: string): AsyncResult<Customer, DomainError> {
    const customer = this.byId.get(id);
    return Promise.resolve(customer ? ok(customer) : err(new CustomerNotFoundError(id)));
  }

  findByEmail(email: string): AsyncResult<Customer | null, DomainError> {
    const found = [...this.byId.values()].find((customer) => customer.email.value === email);
    return Promise.resolve(ok(found ?? null));
  }

  save(customer: Customer): AsyncResult<Customer, DomainError> {
    this.byId.set(customer.id, customer);
    return Promise.resolve(ok(customer));
  }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly byReference = new Map<string, PaymentTransaction>();

  readonly events: TransactionEventRecord[] = [];

  add(transaction: PaymentTransaction): void {
    this.byReference.set(transaction.reference, transaction);
  }

  current(reference: string): PaymentTransaction | undefined {
    return this.byReference.get(reference);
  }

  findByReference(reference: string): AsyncResult<PaymentTransaction, DomainError> {
    const found = this.byReference.get(reference);
    return Promise.resolve(found ? ok(found) : err(new TransactionNotFoundError(reference)));
  }

  lockByReference(reference: string): AsyncResult<PaymentTransaction, DomainError> {
    return this.findByReference(reference);
  }

  save(transaction: PaymentTransaction): AsyncResult<PaymentTransaction, DomainError> {
    this.byReference.set(transaction.reference, transaction);
    return Promise.resolve(ok(transaction));
  }

  recordEvent(event: TransactionEventRecord): AsyncResult<void, DomainError> {
    this.events.push(event);
    return Promise.resolve(okVoid());
  }
}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  private readonly byTransactionId = new Map<string, Delivery>();

  add(delivery: Delivery): void {
    this.byTransactionId.set(delivery.transactionId, delivery);
  }

  current(transactionId: string): Delivery | undefined {
    return this.byTransactionId.get(transactionId);
  }

  findByTransactionId(transactionId: string): AsyncResult<Delivery, DomainError> {
    const found = this.byTransactionId.get(transactionId);
    return Promise.resolve(found ? ok(found) : err(new DeliveryNotFoundError(transactionId)));
  }

  save(delivery: Delivery): AsyncResult<Delivery, DomainError> {
    this.byTransactionId.set(delivery.transactionId, delivery);
    return Promise.resolve(ok(delivery));
  }
}
