import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL?.trim();

  if (
    mode === "production" &&
    process.env.VERCEL === "1" &&
    !apiUrl
  ) {
    throw new Error(
      "VITE_API_URL must be set in Vercel (Settings → Environment Variables). Example: http://dhawan-e-bikes-finance-management.onrender.com (no trailing slash)."
    );
  }

  const apiOrigin = (apiUrl || "http://localhost:5000").replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            icons: ["react-icons"],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
  };
});
