import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        archive: fileURLToPath(new URL('./archive/index.html', import.meta.url)),
        sources: fileURLToPath(new URL('./sources/index.html', import.meta.url)),
        game: fileURLToPath(new URL('./game/index.html', import.meta.url)),
      },
    },
  },
})
