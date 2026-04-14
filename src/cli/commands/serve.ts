import { parseArgs } from "../args.js";
import { handleRequest } from "../../http/routes.js";

export async function runServe(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const port = flags["port"] ? Number(flags["port"]) : 3000;

  const server = Bun.serve({ port, fetch: handleRequest });
  console.error(`repetit HTTP server listening on :${server.port}`);
  // keep alive
  await new Promise(() => {});
}
