// frontend/src/main.jsx (ou index.jsx, dependendo do que o Vite criou)

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Mantenha, se existir

// CORRIJA ESTA LINHA:
import App from './App.jsx'; // ERA './App.js', agora é './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);