import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ds3-cheat-sheet/",
  plugins: [react()]
});
