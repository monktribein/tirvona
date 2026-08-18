import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './context/LanguageContext';
import './styles.css';
import tirvonaFaviconUrl from '../../frontend/public/logo.png';

// Keep the lead app browser tab aligned with the canonical Tirvona logo.
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) favicon.href = tirvonaFaviconUrl;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
