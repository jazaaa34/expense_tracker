import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import handleServerlessApi from "./api/index.js";

function backendApiPlugin() {
  const handleApi = (req, res, mode) => {
    const env = loadEnv(mode, process.cwd(), "");
    for (const [k, v] of Object.entries(env)) {
      if (!process.env[k] && v) {
        process.env[k] = v;
      }
    }
    return handleServerlessApi(req, res);
  };

  return {
    name: "backend-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/api/")) {
          handleApi(req, res, server.config.mode);
        } else {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/api/")) {
          handleApi(req, res, server.config.mode);
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), backendApiPlugin()],
  server: {
    port: 5173,
    host: true,
    open: true
  }
});
