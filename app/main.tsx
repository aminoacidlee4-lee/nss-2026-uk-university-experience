import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import NssExplorer from './NssExplorer';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NssExplorer />
  </StrictMode>,
);
