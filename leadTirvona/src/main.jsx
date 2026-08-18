import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Keep the lead app browser tab aligned with the canonical Tirvona logo.
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) favicon.href = '/logo.png';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
