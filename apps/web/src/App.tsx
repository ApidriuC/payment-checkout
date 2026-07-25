import { Navigate, Route, Routes } from 'react-router-dom';

import { useAppSelector } from '@/app/hooks';
import { Stepper } from '@/components/Stepper';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { ProductPage } from '@/pages/ProductPage';
import { ResultPage } from '@/pages/ResultPage';

export function App() {
  const step = useAppSelector((state) => state.checkout.step);

  return (
    <div className="app">
      <header className="app__bar">
        <a className="app__brand" href="/">
          <span className="app__logo" aria-hidden="true">
            ◈
          </span>
          Tienda
        </a>
        <Stepper current={step} />
      </header>

      <main className="app__main">
        <Routes>
          <Route path="/" element={<ProductPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/result/:reference" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app__footer">
        <p>Pagos procesados de forma segura. No almacenamos los datos de tu tarjeta.</p>
      </footer>
    </div>
  );
}
