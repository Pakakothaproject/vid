import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      define: {
        // As per @google/genai guidelines, the API key must be sourced from process.env.API_KEY.
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
        'process.env.API_KEY2': JSON.stringify(env.API_KEY2),
        'process.env.NEWSDATA_API_KEY': JSON.stringify(env.NEWSDATA_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
