import { handleRequest } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`repetit HTTP server listening on :${server.port}`);
