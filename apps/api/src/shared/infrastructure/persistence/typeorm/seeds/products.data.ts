export interface ProductSeed {
  sku: string;
  name: string;
  description: string;
  priceInCents: number;
  imageUrl: string;
  availableUnits: number;
}

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    sku: 'AUD-ORBIT-01',
    name: 'Audífonos Orbit Pro',
    description:
      'Audífonos over-ear con cancelación activa de ruido, 40 horas de batería y estuche de viaje rígido.',
    priceInCents: 45990000,
    imageUrl: '/images/products/orbit-headphones.svg',
    availableUnits: 12,
  },
  {
    sku: 'TEC-NOVA-87',
    name: 'Teclado Nova 87',
    description:
      'Teclado mecánico inalámbrico de 87 teclas con switches lineales, retroiluminación y estructura de aluminio.',
    priceInCents: 32900000,
    imageUrl: '/images/products/nova-keyboard.svg',
    availableUnits: 8,
  },
  {
    sku: 'MOU-DRIFT-02',
    name: 'Mouse Drift Silent',
    description:
      'Mouse ergonómico inalámbrico de 6 botones con clic silencioso y sensor óptico de 4000 DPI.',
    priceInCents: 12500000,
    imageUrl: '/images/products/drift-mouse.svg',
    availableUnits: 25,
  },
  {
    sku: 'MON-VISTA-27',
    name: 'Monitor Vista 27"',
    description:
      'Monitor IPS de 27 pulgadas, resolución QHD, 144 Hz y base ajustable en altura e inclinación.',
    priceInCents: 128000000,
    imageUrl: '/images/products/vista-monitor.svg',
    availableUnits: 5,
  },
  {
    sku: 'CAM-FOCUS-4K',
    name: 'Cámara Focus 4K',
    description:
      'Cámara web 4K con enfoque automático, micrófono dual con reducción de ruido y obturador de privacidad.',
    priceInCents: 27400000,
    imageUrl: '/images/products/focus-camera.svg',
    availableUnits: 3,
  },
];
