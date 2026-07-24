import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Delivery, DeliveryNotFoundError } from '@/contexts/deliveries/domain/delivery';
import { type DeliveryRepository } from '@/contexts/deliveries/domain/ports/delivery.repository';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError, UnexpectedError } from '@/shared/domain/domain-error';
import { Money } from '@/shared/domain/money';
import { andThen, type AsyncResult, err, fromPromise, ok, type Result } from '@/shared/domain/result';
import { managerFrom } from '@/shared/infrastructure/persistence/typeorm/typeorm-unit-of-work';

import { DeliveryOrmEntity } from './delivery.orm-entity';

@Injectable()
export class TypeOrmDeliveryRepository implements DeliveryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByTransactionId(
    transactionId: string,
    context?: TransactionContext,
  ): AsyncResult<Delivery, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(DeliveryOrmEntity)
        .findOne({ where: { transactionId } }),
      (cause) => new UnexpectedError('No se pudo consultar la entrega.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new DeliveryNotFoundError(transactionId));
    }

    return this.toDomain(row.value);
  }

  async save(delivery: Delivery, context?: TransactionContext): AsyncResult<Delivery, DomainError> {
    const snapshot = delivery.toSnapshot();

    const saved = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(DeliveryOrmEntity)
        .save({
          id: snapshot.id,
          transactionId: snapshot.transactionId,
          customerId: snapshot.customerId,
          status: snapshot.status,
          recipientName: snapshot.address.recipientName,
          recipientPhone: snapshot.address.recipientPhone,
          addressLine1: snapshot.address.addressLine1,
          addressLine2: snapshot.address.addressLine2 ?? null,
          city: snapshot.address.city,
          region: snapshot.address.region,
          country: snapshot.address.country ?? 'CO',
          postalCode: snapshot.address.postalCode ?? null,
          deliveryFeeInCents: snapshot.deliveryFeeInCents,
          trackingCode: snapshot.trackingCode,
          assignedAt: snapshot.assignedAt,
        }),
      (cause) => new UnexpectedError('No se pudo guardar la entrega.', cause),
    );

    if (!saved.ok) {
      return saved;
    }

    return ok(delivery);
  }

  private toDomain(row: DeliveryOrmEntity): Result<Delivery, DomainError> {
    return andThen(Money.fromCents(row.deliveryFeeInCents), (fee) =>
      Delivery.rehydrate(
        {
          id: row.id,
          transactionId: row.transactionId,
          customerId: row.customerId,
          status: row.status,
          address: {
            recipientName: row.recipientName,
            recipientPhone: row.recipientPhone,
            addressLine1: row.addressLine1,
            addressLine2: row.addressLine2,
            city: row.city,
            region: row.region,
            country: row.country,
            postalCode: row.postalCode,
          },
          deliveryFeeInCents: row.deliveryFeeInCents,
          trackingCode: row.trackingCode,
          assignedAt: row.assignedAt,
        },
        fee,
      ),
    );
  }
}
