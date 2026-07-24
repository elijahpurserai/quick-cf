import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  // Single-origin on Cloudflare: the SPA and API share one host, so assets load with
  // root-relative paths. The old VITE_BASE_URL / absolute-CDN-URL indirection (needed
  // when the API build embedded assets pointing at a separate CDN host) is no longer used.
  base: '/',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    headers: {
      'X-Robots-Tag': 'index, follow',
    },
    proxy: {
      // Forward API requests to the Express server
      '/api': 'http://localhost:3001',
      // Forward SEO files to the Express server
      '/robots.txt': 'http://localhost:3001',
      '/sitemap.xml': 'http://localhost:3001',
      '/sitemap-static.xml': 'http://localhost:3001',
      '/sitemap-stories.xml': 'http://localhost:3001',
      '/sitemap-lessons.xml': 'http://localhost:3001',
      '/sitemap-tags.xml': 'http://localhost:3001',
    },
  },
}))
