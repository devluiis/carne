// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Define aliases de caminho para diretórios específicos usando new URL e import.meta.url
      // Esta é uma forma mais robusta de resolver caminhos absolutos no Vite.
      '@components': new URL('./src/components', import.meta.url).pathname,
      '@pages': new URL('./src/pages', import.meta.url).pathname,
      '@': new URL('./src', import.meta.url).pathname, // Um alias genérico para a pasta 'src'

      // Aliases para otimizar a resolução de módulos do Material-UI
      '@mui/material': new URL('./node_modules/@mui/material', import.meta.url).pathname,
      '@mui/icons-material': new URL('./node_modules/@mui/icons-material', import.meta.url).pathname,
    },
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
    ],
  },
  // REMOVA A SEÇÃO 'build.rollupOptions.external' se ela estiver presente em qualquer outro lugar.
});
