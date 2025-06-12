// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Adicione a configuração de otimização de dependências aqui
  optimizeDeps: {
    include: [
      '@emotion/react', // Incluir para Material-UI
      '@emotion/styled', // Incluir para Material-UI
      '@mui/material',    // Incluir para Material-UI
      // Se você usar ícones, adicione: '@mui/icons-material',
    ],
  },
  build: {
    rollupOptions: {
      // Adicione a configuração de 'external' para que o Rollup não tente empacotar
      // o Material-UI se ele não precisa
      external: [
        '@mui/material', // Especifique o pacote principal
        '@mui/material/Button', // Especifique os sub-caminhos que estão dando erro
        '@mui/material/TextField',
        '@mui/material/Box',
        '@mui/material/Typography',
        '@mui/material/Container',
        '@mui/material/CircularProgress',
        '@mui/material/Select',
        '@mui/material/MenuItem',
        '@mui/material/InputLabel',
        '@mui/material/FormControl',
        '@mui/material/FormControlLabel',
        '@mui/material/Checkbox',
        '@mui/material/FormHelperText',
        '@mui/material/Grid', // Se você estiver usando Grid do MUI
        // Adicione quaisquer outros componentes MUI que você esteja usando e que possam causar problemas
        // Por exemplo, se você adicionar Dialog, Snackbar, etc.
      ],
    },
  },
});