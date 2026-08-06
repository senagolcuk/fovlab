import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // three.js and MUI change far less often than this app does; splitting them keeps a
        // redeploy from invalidating a megabyte of unchanged vendor code in everyone's cache.
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
