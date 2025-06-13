// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // Importar o módulo 'path' do Node.js

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Define aliases de caminho para diretórios específicos usando path.resolve e process.cwd()
      // Esta é uma forma mais robusta de resolver caminhos absolutos em diferentes ambientes de build.
      '@components': path.resolve(process.cwd(), 'src/components'),
      '@pages': path.resolve(process.cwd(), 'src/pages'),
      '@': path.resolve(process.cwd(), 'src'), // Um alias genérico para a pasta 'src'

      // Aliases para otimizar a resolução de módulos do Material-UI
      '@mui/material': path.resolve(process.cwd(), 'node_modules/@mui/material'),
      '@mui/icons-material': path.resolve(process.cwd(), 'node_modules/@mui/icons-material'),
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
  // Certifique-se de que não há uma seção 'build.rollupOptions.external' que esteja excluindo esses módulos.
});
