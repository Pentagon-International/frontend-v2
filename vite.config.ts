import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@store': resolve(__dirname, './src/store'),
      '@api': resolve(__dirname, './src/api'),
      '@layout': resolve(__dirname, './src/layout'),
      '@theme': resolve(__dirname, './src/theme'),
      '@assets': resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 5173,
    open: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
  },
  // Define template name and metadata
  define: {
    'import.meta.env.VITE_APP_NAME': JSON.stringify('Pentafox Starter Kit'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: { skipLibCheck: true }
    }
  }
})
