import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' deixa o build funcionar em qualquer subpasta (GitHub Pages, Netlify, etc.)
export default defineConfig({ base: './', plugins: [react()] })
