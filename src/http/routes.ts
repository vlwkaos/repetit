import { upsertItems, getItem, listItems } from "../core/items.js";
import { upsertLearner, getLearner, getConfig, updateConfig } from "../core/learners.js";
import { nextDue } from "../core/queue.js";
import { recordReview } from "../core/review.js";
import { getDueCounts } from "../core/queue.js";
import { jsonResponse, errorResponse } from "./json.js";
import type { Rating } from "../core/types.js";

/** All routes require X-Learner-Id header. Learner is auto-created on first request. */
function learnerId(req: Request): string | null {
  return req.headers.get("x-learner-id");
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // health
  if (method === "GET" && path === "/healthz") {
    return jsonResponse({ ok: true });
  }

  // items
  if (method === "POST" && path === "/items") {
    let body: unknown;
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON", 400); }
    const arr = Array.isArray(body) ? body : [body];
    for (const item of arr) {
      if (typeof item?.uid !== "string" || item.payload === undefined) {
        return errorResponse("Each item requires uid (string) and payload", 400);
      }
    }
    const n = upsertItems(arr as Array<{ uid: string; tags?: string[]; payload: unknown }>);
    return jsonResponse({ upserted: n });
  }

  if (method === "GET" && path.startsWith("/items/")) {
    const uid = decodeURIComponent(path.slice(7));
    const item = getItem(uid);
    if (!item) return errorResponse("Item not found", 404);
    return jsonResponse(item);
  }

  if (method === "GET" && path === "/items") {
    const tag = url.searchParams.get("tag") ?? undefined;
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    return jsonResponse(listItems({ tag, limit }));
  }

  // learner-scoped routes
  const lid = learnerId(req);

  if (method === "GET" && path === "/next") {
    if (!lid) return errorResponse("X-Learner-Id header required", 400);
    upsertLearner({ id: lid });
    const tag = url.searchParams.get("tag") ?? undefined;
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 1;
    const items = nextDue({ learnerId: lid, limit, tag });
    return jsonResponse(items);
  }

  if (method === "POST" && path === "/rate") {
    if (!lid) return errorResponse("X-Learner-Id header required", 400);
    upsertLearner({ id: lid });
    let body: any;
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON", 400); }
    const { uid, rating, elapsedMs } = body;
    if (typeof uid !== "string") return errorResponse("uid required", 400);
    if (![1, 2, 3, 4].includes(rating)) return errorResponse("rating must be 1-4", 400);
    try {
      const result = recordReview({ learnerId: lid, uid, rating: rating as Rating, elapsedMs });
      return jsonResponse(result);
    } catch (e: any) {
      if (e.message?.includes("not found")) return errorResponse(e.message, 404);
      throw e;
    }
  }

  if (method === "GET" && path === "/queue") {
    if (!lid) return errorResponse("X-Learner-Id header required", 400);
    upsertLearner({ id: lid });
    const tag = url.searchParams.get("tag") ?? undefined;
    return jsonResponse(getDueCounts({ learnerId: lid, tag }));
  }

  if (method === "GET" && path === "/learners/me") {
    if (!lid) return errorResponse("X-Learner-Id header required", 400);
    upsertLearner({ id: lid });
    const learner = getLearner(lid)!;
    const config = getConfig(lid);
    return jsonResponse({ ...learner, config });
  }

  if (method === "PATCH" && path === "/learners/me/config") {
    if (!lid) return errorResponse("X-Learner-Id header required", 400);
    upsertLearner({ id: lid });
    let body: any;
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON", 400); }
    const config = updateConfig(lid, {
      dailyNewLimit: body.dailyNewLimit,
      dailyReviewLimit: body.dailyReviewLimit,
      targetRetention: body.targetRetention,
      tzOffsetMinutes: body.tzOffsetMinutes,
      fsrsWeights: body.fsrsWeights,
    });
    return jsonResponse(config);
  }

  return errorResponse("Not found", 404);
}
