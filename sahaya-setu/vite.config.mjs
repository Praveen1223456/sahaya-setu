import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'client'),
  publicDir: path.resolve(__dirname, 'static'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
      },
      '/app': 'http://localhost:8000',
      '/geo': 'http://localhost:8000',
      '/ai': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/sos': 'http://localhost:8000',
      '/sms': 'http://localhost:8000',
      '/mesh': 'http://localhost:8000',
      '/voice': 'http://localhost:8000',
      '/track': 'http://localhost:8000',
      '/incidents': 'http://localhost:8000',
      '/citizens': 'http://localhost:8000',
      '/alerts': 'http://localhost:8000',
      '/shelters': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/outbox': 'http://localhost:8000',
      '/sitrep': 'http://localhost:8000',
      '/public': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/shared': 'http://localhost:8000',
      '/vendor': 'http://localhost:8000',
    },
  },
});
