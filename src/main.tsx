import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ProveedorTema } from './tema/TemaContexto.tsx';
import { ErrorBoundary } from './componentes/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorTema>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ProveedorTema>
  </StrictMode>,
);

