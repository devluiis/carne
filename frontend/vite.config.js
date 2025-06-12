// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // Importe o módulo 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Isso ajuda o Rollup a resolver corretamente os sub-imports do Material-UI
      // Certifique-se de que '__dirname' é acessível ou ajuste o caminho.
      // Em um ambiente Vite/Node.js, path.resolve() é seguro.
      '@mui/material': path.resolve(__dirname, 'node_modules/@mui/material'),
    },
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      // Se você usar ícones, adicione: '@mui/icons-material',
    ],
  },
  // REMOVA A SEÇÃO 'build.rollupOptions.external'
});