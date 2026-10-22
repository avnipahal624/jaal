/// <reference types="vite/client" />
/**
 * Module glob consumed by convex-test: every Convex function file in this
 * directory (test files — anything with a second extension — are excluded).
 */
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
