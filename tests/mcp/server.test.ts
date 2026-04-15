import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import { unlinkSync, existsSync } from "fs";

const CLI = join(import.meta.dir, "../../src/cli/main.ts");

// ---------------------------------------------------------------------------
// MCP process harness — one process per describe block, shared temp-file DB
// ---------------------------------------------------------------------------

type McpProc = {
  call: (toolName: string, args?: Record<string, unknown>) => Promise<unknown>;
  list: () => Promise<Array<{ name: string; description: string }>>;
  kill: () => void;
};

async function startMcp(db: string): Promise<McpProc> {
  const proc = Bun.spawn(["bun", CLI, "mcp"], {
    env: { ...process.env, REPETIT_DB: db },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let idSeq = 0;

  async function readLine(timeoutMs = 5000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) return line;
      }
      if (Date.now() > deadline) throw new Error("MCP read timeout");
      const { done, value } = await reader.read();
      if (done) throw new Error("MCP stdout closed");
      buf += decoder.decode(value, { stream: true });
    }
  }

  function send(msg: unknown) {
    proc.stdin.write(JSON.stringify(msg) + "\n");
    proc.stdin.flush();
  }

  // MCP handshake
  const initId = ++idSeq;
  send({
    jsonrpc: "2.0", id: initId, method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    },
  });
  await readLine(); // consume initialize response
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  async function call(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const id = ++idSeq;
    send({ jsonrpc: "2.0", id, method: "tools/call", params: { name: toolName, arguments: args } });
    const line = await readLine();
    const msg = JSON.parse(line);
    if (msg.error) throw new Error(msg.error.message ?? JSON.stringify(msg.error));
    const textContent = msg.result?.content?.[0]?.text;
    if (textContent === undefined) throw new Error("No text content in response");
    const parsed = JSON.parse(textContent);
    // MCP server returns isError:true in result for tool-level errors
    if (msg.result?.isError) throw new Error(parsed?.error ?? textContent);
    return parsed;
  }

  async function list(): Promise<Array<{ name: string; description: string }>> {
    const id = ++idSeq;
    send({ jsonrpc: "2.0", id, method: "tools/list", params: {} });
    const line = await readLine();
    const msg = JSON.parse(line);
    return msg.result.tools;
  }

  return { call, list, kill: () => proc.kill() };
}

// Seed one item directly via import_items tool
async function seedItem(mcp: McpProc, uid = "q:1", tags: string[] = []) {
  await mcp.call("import_items", { items: [{ uid, tags, payload: { front: "F", back: "B" } }] });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP tools/list", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("exposes all 6 tools", async () => {
    const tools = await mcp.list();
    const names = tools.map((t) => t.name);
    expect(names).toContain("get_next");
    expect(names).toContain("submit_review");
    expect(names).toContain("import_items");
    expect(names).toContain("list_items");
    expect(names).toContain("get_due_counts");
    expect(names).toContain("import_apkg");
    expect(names.length).toBe(6);
  });

  it("submit_review description mentions metadata and agent_notes", async () => {
    const tools = await mcp.list();
    const submitReview = tools.find((t) => t.name === "submit_review")!;
    expect(submitReview.description).toMatch(/metadata/i);
    expect(submitReview.description).toMatch(/agent_notes/i);
  });
});

describe("MCP get_next", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("returns { agentPrompt, items } shape", async () => {
    const result = await mcp.call("get_next", { learner_id: "alice" }) as any;
    expect(result).toHaveProperty("agentPrompt");
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("agentPrompt is null when not configured", async () => {
    const result = await mcp.call("get_next", { learner_id: "alice" }) as any;
    expect(result.agentPrompt).toBeNull();
  });

  it("returns seeded item with agentNotes and lastReview null", async () => {
    await seedItem(mcp, "q:1");
    const result = await mcp.call("get_next", { learner_id: "alice", limit: 5 }) as any;
    expect(result.items.length).toBeGreaterThan(0);
    const item = result.items.find((i: any) => i.uid === "q:1");
    expect(item).toBeDefined();
    expect(item.agentNotes).toBeNull();
    expect(item.lastReview).toBeNull();
  });

  it("filters by tag", async () => {
    await mcp.call("import_items", { items: [
      { uid: "cpp:1", tags: ["cpp"], payload: {} },
      { uid: "go:1",  tags: ["go"],  payload: {} },
    ]});
    const result = await mcp.call("get_next", { learner_id: "alice", tag: "cpp", limit: 5 }) as any;
    expect(result.items.every((i: any) => i.tags.includes("cpp"))).toBe(true);
  });
});

describe("MCP submit_review", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("returns scheduling result", async () => {
    await seedItem(mcp, "q:1");
    const result = await mcp.call("submit_review", { learner_id: "alice", uid: "q:1", rating: 3 }) as any;
    expect(typeof result.nextDueAt).toBe("string");
    expect(result.stability).toBeGreaterThan(0);
    expect(result.difficulty).toBeGreaterThan(0);
    expect([0, 1, 2, 3]).toContain(result.state);
  });

  it("accepts metadata and agent_notes without error", async () => {
    await seedItem(mcp, "q:2");
    const result = await mcp.call("submit_review", {
      learner_id: "alice",
      uid: "q:2",
      rating: 2,
      metadata: { note: "missed edge case", confidence: "low" },
      agent_notes: "Weak on pointers.",
    }) as any;
    expect(typeof result.nextDueAt).toBe("string");
  });

  it("returns error for unknown uid", async () => {
    let threw = false;
    try {
      await mcp.call("submit_review", { learner_id: "alice", uid: "no:such", rating: 3 });
    } catch (e: any) {
      threw = true;
      expect(e.message ?? e).toMatch(/not found/i);
    }
    expect(threw).toBe(true);
  });
});

describe("MCP import_items + list_items", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("import_items returns upserted count", async () => {
    const result = await mcp.call("import_items", {
      items: [
        { uid: "a:1", tags: ["alpha"], payload: { q: 1 } },
        { uid: "b:1", tags: ["beta"],  payload: { q: 2 } },
      ],
    }) as any;
    expect(result.upserted).toBe(2);
  });

  it("import_items is idempotent", async () => {
    await mcp.call("import_items", { items: [{ uid: "a:1", tags: ["alpha"], payload: {} }] });
    const result = await mcp.call("list_items", {}) as any;
    expect(result.filter((i: any) => i.uid === "a:1").length).toBe(1);
  });

  it("list_items filters by tag", async () => {
    const result = await mcp.call("list_items", { tag: "alpha" }) as any;
    expect(result.every((i: any) => i.tags.includes("alpha"))).toBe(true);
  });
});

describe("MCP get_due_counts", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("returns newCount and dueCount", async () => {
    await seedItem(mcp, "q:1");
    const result = await mcp.call("get_due_counts", { learner_id: "alice" }) as any;
    expect(result.newCount).toBe(1);
    expect(result.dueCount).toBe(0);
  });

  it("newCount drops to 0 after review", async () => {
    await mcp.call("submit_review", { learner_id: "alice", uid: "q:1", rating: 3 });
    const result = await mcp.call("get_due_counts", { learner_id: "alice" }) as any;
    expect(result.newCount).toBe(0);
  });
});

describe("MCP unknown tool", () => {
  const db = join(tmpdir(), `repetit-mcp-${randomBytes(6).toString("hex")}.db`);
  let mcp: McpProc;
  beforeAll(async () => { mcp = await startMcp(db); });
  afterAll(() => { mcp.kill(); if (existsSync(db)) unlinkSync(db); });

  it("returns isError response for unknown tool name", async () => {
    // The MCP server catches unknown tools and returns isError:true in content
    // Our call() helper parses the text and checks for error field
    let threw = false;
    try {
      await mcp.call("no_such_tool", {});
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
