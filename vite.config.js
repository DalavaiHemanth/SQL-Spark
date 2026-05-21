import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base: '/' works if you use a custom domain or root GitLab Pages.
// If deployed at https://username.gitlab.io/SQL-Spark/ change base to '/SQL-Spark/'
export default defineConfig({
    base: '/',
    plugins: [
        react(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            // Forward /api/resend/* -> https://api.resend.com/* (avoids browser CORS)
            '/api/resend': {
                target: 'https://api.resend.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/resend/, ''),
            },
        },
    },
});