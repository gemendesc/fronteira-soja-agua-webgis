import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

function vercelApiDevPlugin(): Plugin {
  return {
    name: "vercel-api-local-dev",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      if (env.DATABASE_URL && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = env.DATABASE_URL;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          return next();
        }
        try {
          const parsed = new URL(req.url, "http://localhost");
          const routeName = parsed.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
          const modulePath = path.resolve(process.cwd(), "api", `${routeName}.ts`);
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default;

          const query: Record<string, string> = {};
          parsed.searchParams.forEach((v, k) => {
            query[k] = v;
          });

          const vercelReq: any = Object.assign(req, { query });
          const vercelRes: any = {
            statusCode: 200,
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status(code: number) {
              this.statusCode = code;
              res.statusCode = code;
              return this;
            },
            json(payload: unknown) {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(payload));
              return this;
            },
            send(payload: Buffer | string) {
              res.end(payload);
              return this;
            },
          };

          await handler(vercelReq, vercelRes);
        } catch (err: any) {
          console.error("[vite-api-dev]", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Internal dev API error" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vercelApiDevPlugin()],
});
