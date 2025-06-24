import react from "@vitejs/plugin-react";
export default {
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Prevent filename hashing to avoid browser caching issues
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  // Disable all caching during development
  optimizeDeps: {
    force: true
  }
};
