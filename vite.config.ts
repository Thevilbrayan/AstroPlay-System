import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <--- Esto es lo que "pega" el diseño a la app
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true, // Vital para que Tauri lo detecte
  },
});