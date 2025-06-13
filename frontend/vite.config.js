// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // Importar o módulo 'path' do Node.js

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Aliases para os diretórios locais do seu projeto (essencial para resolver os erros "Could not resolve")
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@': path.resolve(__dirname, './src'), // Alias genérico para a pasta 'src'

      // Aliases para otimizar a resolução de módulos do Material-UI (o que você já tinha adicionado)
      '@mui/material': path.resolve(__dirname, 'node_modules/@mui/material'),
      '@mui/icons-material': path.resolve(__dirname, 'node_modules/@mui/icons-material'), // Adicionado para icons
    },
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material', // Incluído para otimização dos ícones
    ],
  },
  // REMOVA A SEÇÃO 'build.rollupOptions.external' se ela estiver presente em qualquer outro lugar.
});