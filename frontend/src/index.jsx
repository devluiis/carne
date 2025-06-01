import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Importa o componente principal da sua aplicação
import './index.css'; // Importa os estilos CSS globais

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);