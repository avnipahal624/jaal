import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as actions from "../actions.js";
import type * as ai from "../ai.js";
import type * as jaal from "../jaal.js";
import type * as evidenceGraph from "../evidenceGraph.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  ai: typeof ai;
  jaal: typeof jaal;
  evidenceGraph: typeof evidenceGraph;
  users: typeof users;
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<"query" | "mutation" | "action", "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<"query" | "mutation" | "action", "internal">>;
