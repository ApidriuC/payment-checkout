import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema1784926800000 implements MigrationInterface {
  name = 'InitialSchema1784926800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(64) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" text NOT NULL,
        "price_in_cents" bigint NOT NULL,
        "currency" character(3) NOT NULL DEFAULT 'COP',
        "image_url" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_sku" UNIQUE ("sku"),
        CONSTRAINT "CHK_products_price_positive" CHECK ("price_in_cents" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "available_units" integer NOT NULL,
        "reserved_units" integer NOT NULL DEFAULT 0,
        "version" integer NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_stock_items_product" UNIQUE ("product_id"),
        CONSTRAINT "CHK_stock_items_available_non_negative" CHECK ("available_units" >= 0),
        CONSTRAINT "CHK_stock_items_reserved_non_negative" CHECK ("reserved_units" >= 0),
        CONSTRAINT "FK_stock_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "full_name" character varying(160) NOT NULL,
        "phone_number" character varying(20) NOT NULL,
        "legal_id_type" character varying(10),
        "legal_id" character varying(32),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transactions_status_enum" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')
    `);
    await queryRunner.query(`
      CREATE TYPE "transactions_card_brand_enum" AS ENUM ('VISA', 'MASTERCARD', 'UNKNOWN')
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying(64) NOT NULL,
        "customer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "product_amount_in_cents" bigint NOT NULL,
        "base_fee_in_cents" bigint NOT NULL,
        "delivery_fee_in_cents" bigint NOT NULL,
        "total_amount_in_cents" bigint NOT NULL,
        "currency" character(3) NOT NULL DEFAULT 'COP',
        "status" "transactions_status_enum" NOT NULL DEFAULT 'PENDING',
        "gateway_transaction_id" character varying(64),
        "gateway_status" character varying(32),
        "failure_reason" text,
        "card_brand" "transactions_card_brand_enum",
        "card_last_four" character(4),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_reference" UNIQUE ("reference"),
        CONSTRAINT "CHK_transactions_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_transactions_total_matches_breakdown" CHECK (
          "total_amount_in_cents" = "product_amount_in_cents" + "base_fee_in_cents" + "delivery_fee_in_cents"
        ),
        CONSTRAINT "FK_transactions_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transactions_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_customer" ON "transactions" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_product" ON "transactions" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_gateway_id" ON "transactions" ("gateway_transaction_id")`,
    );

    await queryRunner.query(`
      CREATE TYPE "transaction_events_source_enum" AS ENUM ('API', 'GATEWAY_WEBHOOK')
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_id" uuid NOT NULL,
        "from_status" character varying(20) NOT NULL,
        "to_status" character varying(20) NOT NULL,
        "source" "transaction_events_source_enum" NOT NULL,
        "payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transaction_events_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_events_transaction" ON "transaction_events" ("transaction_id")`,
    );

    await queryRunner.query(`
      CREATE TYPE "deliveries_status_enum" AS ENUM ('PENDING', 'ASSIGNED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "status" "deliveries_status_enum" NOT NULL DEFAULT 'PENDING',
        "recipient_name" character varying(160) NOT NULL,
        "recipient_phone" character varying(20) NOT NULL,
        "address_line_1" character varying(255) NOT NULL,
        "address_line_2" character varying(255),
        "city" character varying(120) NOT NULL,
        "region" character varying(120) NOT NULL,
        "country" character(2) NOT NULL DEFAULT 'CO',
        "postal_code" character varying(20),
        "delivery_fee_in_cents" bigint NOT NULL,
        "tracking_code" character varying(64),
        "assigned_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_deliveries_transaction" UNIQUE ("transaction_id"),
        CONSTRAINT "FK_deliveries_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_deliveries_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_deliveries_customer" ON "deliveries" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_deliveries_status" ON "deliveries" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deliveries"`);
    await queryRunner.query(`DROP TYPE "deliveries_status_enum"`);
    await queryRunner.query(`DROP TABLE "transaction_events"`);
    await queryRunner.query(`DROP TYPE "transaction_events_source_enum"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "transactions_card_brand_enum"`);
    await queryRunner.query(`DROP TYPE "transactions_status_enum"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TABLE "stock_items"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
