import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Public Supabase settings (safe in the app: every table is protected by row-level security).
// Used when the host does not provide a .env, so the deployed app always reaches its backend.
const DEFAULT_SUPABASE_URL = 'https://vhlrfkndubpmxqfzusoo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_J6ROQsIlVZfpgz4tdFQiww_ifTfV7dl';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY),
    },
    build: {
      // Split big libraries into their own files so the app loads in parallel and caches better.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            three: ['three', '@react-three/fiber', '@react-three/drei'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
      // The 3D engine (three.js) is one library of about 700 kB on its own and cannot be split further.
      chunkSizeWarningLimit: 900,
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
