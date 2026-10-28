import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleGroqApi, DEFAULT_GROQ_MODEL } from "./api/groqHandler.js";
import { handleOtpApi } from "./api/otpHandler.js";
import { handleBillExtractApi } from "./api/billExtractHandler.js";
import { handleDataApi } from "./api/dataHandler.js";

function backendApiPlugin() {
  const handleApi = (req, res, mode) => {
    const env = loadEnv(mode, process.cwd(), "");
    for (const [k, v] of Object.entries(env)) {
      if (!process.env[k] && v) {
        process.env[k] = v;
      }
    }
    if (req.url && req.url.startsWith("/api/bills/extract")) {
      const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || "";
      const anthropicKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || "";
      return handleBillExtractApi(req, res, { geminiKey, anthropicKey });
    }
    if (req.url && req.url.startsWith("/api/auth/")) {
      const brevoKey = process.env.BREVO_API_KEY || env.BREVO_API_KEY || "";
      const senderEmail = process.env.BREVO_SENDER_EMAIL || env.BREVO_SENDER_EMAIL || "jazaaa34@gmail.com";
      const senderName = process.env.BREVO_SENDER_NAME || env.BREVO_SENDER_NAME || "WalletWeather";
      return handleOtpApi(req, res, brevoKey, senderEmail, senderName);
    }
    if (req.url && req.url.startsWith("/api/db/")) {
      if (!process.env.MONGODB_URI && env.MONGODB_URI) {
        process.env.MONGODB_URI = env.MONGODB_URI;
      }
      if (!process.env.MONGODB_DB_NAME && env.MONGODB_DB_NAME) {
        process.env.MONGODB_DB_NAME = env.MONGODB_DB_NAME;
      }
      return handleDataApi(req, res);
    }
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY || "";
    const model = process.env.GROQ_MODEL || env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    return handleGroqApi(req, res, apiKey, model);
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
