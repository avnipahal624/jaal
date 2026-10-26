import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as actions from "../actions.js";
import type * as ai from "../ai.js";
import type * as jaal from "../jaal.js";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  ai: typeof ai;
  jaal: typeof jaal;
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
