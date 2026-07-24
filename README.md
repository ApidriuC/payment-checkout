# Payment Checkout

Aplicación fullstack de checkout con pago por tarjeta de crédito: un SPA móvil-first en React
y una API en NestJS con arquitectura hexagonal (Ports & Adapters) y Railway Oriented Programming.

> Estado: en construcción. Este README se completa por etapas junto con el código.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Redux Toolkit + redux-persist |
| Backend | NestJS 11 + TypeScript + TypeORM |
| Base de datos | PostgreSQL (Neon) |
| Tests | Jest (backend y frontend) |
| Infraestructura | AWS — S3 + CloudFront (SPA), Lambda (API) |

## Estructura del monorepo

```
payment-checkout/
├── apps/
│   ├── api/   → API NestJS (arquitectura hexagonal)
│   └── web/   → SPA React (mobile-first)
├── docs/      → Diagramas y documentación de diseño
└── package.json  → npm workspaces
```

## Requisitos

- Node.js >= 20
- Una base de datos PostgreSQL accesible (connection string)

## Puesta en marcha

```bash
npm install          # instala ambos workspaces
npm run dev:api      # levanta la API en modo watch
npm run dev:web      # levanta el SPA
```

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run build` | Compila API y SPA |
| `npm test` | Ejecuta los tests de ambos workspaces |
| `npm run test:cov` | Ejecuta los tests con reporte de cobertura |
| `npm run lint` | Linting de ambos workspaces |
| `npm run seed` | Puebla la base de datos con productos de prueba |

## Seguridad

### Auditoría de dependencias

`npm audit` reporta un aviso sin versión corregida disponible:

- **`react-router` (GHSA-qwww-vcr4-c8h2)** — CSRF bypass en *RSC mode*. Afecta al rango
  `7.12.0 – 8.2.0` y no existe parche dentro de la línea 7.x; las versiones anteriores
  (`< 7.12.0`) acumulan avisos más graves (XSS, open redirect, RCE vía turbo-stream), por lo
  que se mantiene la última versión publicada. **No aplica a esta aplicación**: el SPA usa
  únicamente enrutado en cliente (`BrowserRouter`) y no habilita las APIs RSC de React Router.

## Licencia

MIT
