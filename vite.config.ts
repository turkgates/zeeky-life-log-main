import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const anonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wIaztfCVlOPLSscmFRLcqQ_XOS7jB0W'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/functions': {
          target: 'https://gmcmreinpnhuszxlpgpj.supabase.co',
          changeOrigin: true,
          secure: true,
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'x-client-info': 'zeeky-web',
          },
        },
      },
    },
  }
})