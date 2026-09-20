import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{ host:'127.0.0.1', port:5173, strictPort:true,
    proxy:{ '/api':{ target:'http://127.0.0.1:7071', changeOrigin:false } },
    fs:{ strict:true, deny:['.env', '.env.*', '**/local.settings.json', '**/.photovault-secrets.json', '**/.git/**', '**/api/**'] }
  },
  preview:{ host:'127.0.0.1', port:4173, strictPort:true },
  build:{ target:'es2022', sourcemap:false }
});
