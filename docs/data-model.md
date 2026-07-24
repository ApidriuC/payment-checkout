# Modelo de datos

PostgreSQL. Todos los importes se guardan en **centavos** (`BIGINT`) para evitar errores de
redondeo con decimales, y toda marca de tiempo es `TIMESTAMPTZ`.

## Diagrama entidad-relación

```mermaid
erDiagram
    PRODUCTS      ||--|| STOCK_ITEMS        : "tiene stock"
    PRODUCTS      ||--o{ TRANSACTIONS       : "se vende en"
    CUSTOMERS     ||--o{ TRANSACTIONS       : "realiza"
    TRANSACTIONS  ||--o| DELIVERIES         : "genera"
    TRANSACTIONS  ||--o{ TRANSACTION_EVENTS : "registra"
    CUSTOMERS     ||--o{ DELIVERIES         : "recibe"

    PRODUCTS {
        uuid        id PK
        varchar     sku UK
        varchar     name
        text        description
        bigint      price_in_cents
        char        currency
        text        image_url
        timestamptz created_at
        timestamptz updated_at
    }

    STOCK_ITEMS {
        uuid        id PK
        uuid        product_id FK,UK
        int         available_units
        int         reserved_units
        int         version
        timestamptz updated_at
    }

    CUSTOMERS {
        uuid        id PK
        varchar     email UK
        varchar     full_name
        varchar     phone_number
        varchar     legal_id_type
        varchar     legal_id
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTIONS {
        uuid        id PK
        varchar     reference UK
        uuid        customer_id FK
        uuid        product_id FK
        int         quantity
        bigint      product_amount_in_cents
        bigint      base_fee_in_cents
        bigint      delivery_fee_in_cents
        bigint      total_amount_in_cents
        char        currency
        enum        status
        varchar     gateway_transaction_id
        varchar     gateway_status
        text        failure_reason
        varchar     card_brand
        char        card_last_four
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at
    }

    DELIVERIES {
        uuid        id PK
        uuid        transaction_id FK,UK
        uuid        customer_id FK
        enum        status
        varchar     recipient_name
        varchar     recipient_phone
        varchar     address_line_1
        varchar     address_line_2
        varchar     city
        varchar     region
        char        country
        varchar     postal_code
        bigint      delivery_fee_in_cents
        varchar     tracking_code
        timestamptz assigned_at
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTION_EVENTS {
        uuid        id PK
        uuid        transaction_id FK
        varchar     from_status
        varchar     to_status
        enum        source
        jsonb       payload
        timestamptz created_at
    }
```

## Decisiones de diseño

### `stock_items` separada de `products`

El stock cambia con cada compra mientras que los datos del producto son casi inmutables.
Tenerlo en su propia tabla permite bloquear la fila de stock (`SELECT ... FOR UPDATE`) durante
una compra sin bloquear el catálogo, y expone `stock` como recurso propio de la API.

### Reserva de unidades

`stock_items` distingue `available_units` de `reserved_units`. Al crear una transacción en
`PENDING` las unidades pasan de disponibles a reservadas; el resultado del pago decide su
destino final:

| Resultado del pago | `available_units` | `reserved_units` |
| --- | --- | --- |
| `APPROVED` | sin cambio | `- cantidad` (unidades vendidas) |
| `DECLINED` / `VOIDED` / `ERROR` | `+ cantidad` (se liberan) | `- cantidad` |

Sin esta reserva, dos clientes podrían pagar la última unidad simultáneamente porque la
llamada al gateway no es instantánea. La columna `version` añade bloqueo optimista como
segunda defensa ante escrituras concurrentes.

### Datos sensibles

**Nunca se persiste el número completo de la tarjeta, la fecha de expiración ni el CVC.**
El PAN viaja directamente del navegador al gateway para ser tokenizado; el backend solo
almacena `card_brand` y `card_last_four`, que es lo mínimo para que el cliente reconozca su
compra. El token de la tarjeta se usa una sola vez y tampoco se guarda.

### Identidad del cliente

`customers.email` es único y se normaliza a minúsculas antes de persistirlo, de modo que un
mismo comprador que vuelve al checkout reutiliza su registro en lugar de duplicarse.

### `reference` como número de transacción

La PK es un UUID interno. Hacia afuera se expone `reference`, una cadena única e irrepetible
que también viaja al gateway como identificador del pago, lo que permite conciliar ambos
sistemas y hace la creación de transacciones idempotente frente a reintentos del cliente.

### `transaction_events`

Bitácora append-only de cada cambio de estado, con su origen (`API`, `GATEWAY_WEBHOOK`) y el
payload recibido. Sirve para auditoría y para descartar webhooks duplicados o desordenados
del gateway sin corromper el estado de la transacción.

## Estados

| Tabla | Estados |
| --- | --- |
| `transactions.status` | `PENDING` → `APPROVED` \| `DECLINED` \| `VOIDED` \| `ERROR` |
| `deliveries.status` | `PENDING` → `ASSIGNED` → `SHIPPED` → `DELIVERED` \| `CANCELLED` |
| `transaction_events.source` | `API`, `GATEWAY_WEBHOOK` |
