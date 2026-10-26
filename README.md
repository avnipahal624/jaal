## Overview

JAAL Investigator is a **scam-analysis training simulation**. Every case, message, identifier and timestamp in the app is synthetic; no real scammers or third parties are ever contacted.

### Session and data boundaries

- **Account sign-in** at `/auth` uses Convex Auth. Backend queries, mutations, and AI actions require an authenticated identity and scope records to that identity.
- **Simulation login** at `/login` is a local-only demonstration mode. Its local browser session is not authentication and does not grant access to Convex-backed records or AI provider actions.
- SHA-256 checks the integrity of a stored snapshot; it does not independently prove source authenticity or make a report legally evidentiary.
- The AI provider is optional. JAAL's deterministic simulation remains available without an Anthropic key. Configure provider-side quotas and monitor usage before exposing a deployment publicly.

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# JAAL Backend (Convex)

The investigation workflow runs on the managed Convex deployment — there is no separate API server. All case data lives in Convex tables and the React UI subscribes to it in real time.

## Architecture

- `src/convex/schema.ts` — tables: `investigations`, `sessions`, `messages`, `evidence`, `tactics`, `events`, `logs`, `strategies`, `reports`, `settings`, `users`.
- `src/convex/jaal.ts` — public queries/mutations: `state` (reactive workspace snapshot), `createInvestigation`, `sendMessage`, `simulationNext`, `ingestMessages`, `generateHash`, `verifyEvidence`, `setEvidenceContent` / `setEvidenceNotes`, `setRunStatus`, `completeInvestigation`, `resetCase`, `generateReport`, `seedDemo`, `updateSettings`, and more.
- `src/convex/lib/backend.ts` — the shared pipeline: tactic detection, kill-chain progression, identifier extraction (UPI/VPA, phone, payment amount, link, IP, email), server-side SHA-256 hashing, activity events and log entries. Original message content is never mutated.
- `src/convex/ai.ts` — Anthropic Claude calls (`"use node"` action) for investigation strategy and report summaries.
- `src/convex/actions.ts` — action wrappers (`sendMessageWithAI`, `simulationNextWithAI`, `generateReportWithAI`, `approveStrategyWithAI`) that try the LLM first and fall back to the deterministic simulation engine, labelled `SIMULATION` in logs and in the UI.
- `src/state/JaalProvider.tsx` — hydrates the frontend from `api.jaal.state` via `useQuery` and routes every command through mutations/actions. A local reducer remains only as an offline fallback.

## Full verified workflow

create → message (operator or simulated) → analysis (tactics + intent + strategy) → evidence extraction → SHA-256 hash → integrity verify (match / tamper / mismatch) → kill-chain progression → complete → report generation. Evidence integrity is verifiable from the client SHA-256 as well as the server hash.

## Engine modes

- **ANTHROPIC** — set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-sonnet-4-5`) on the Convex deployment: `npx convex env set ANTHROPIC_API_KEY sk-ant-...`. Strategy and report actions then call Claude; the workspace labels the engine "Convex action — Anthropic Claude".
- **SIMULATION** (default, no key required) — every action falls back to the deterministic rules engine and the UI is clearly labelled "Simulation mode — analysis engine".

Convex-side keys are never exposed to the browser bundle.

## API reference (frontend service contract)

The React app calls these through `src/state/JaalProvider.tsx`; they are the
equivalent of the REST surface (REST-style paths in parentheses).

**Queries**

| Function | Purpose |
| --- | --- |
| `jaal.state` (`GET /api/state`) | Full owner-scoped workspace: investigations, sessions (messages, evidence, tactics, stages, logs, events, strategy), reports, settings. Reactive — this is the real-time channel. |
| `jaal.dashboard` (`GET /api/dashboard`) | Counts + recent activity computed from the database. |
| `jaal.investigationMeta` (`GET /api/investigations/:id`) | Tactics + detected-stage labels for report generation. |
| `jaal.pendingStrategy` (`GET /api/investigations/:id/strategy`) | Current pending strategy suggestion. |
| `jaal.getReport` / `jaal.reports` (`GET /api/reports[/:id]`) | Generated reports. |
| `jaal.getEvidence` (`GET /api/evidence/:id`) | Evidence + original source message. |
| `jaal.getSettings` (`GET /api/settings`) | Owner settings. |

**Mutations**

| Function | Purpose |
| --- | --- |
| `jaal.createInvestigation` (`POST /api/investigations`) | Create case, seed opening line, run pipeline, build strategy. |
| `jaal.sendMessage` (`POST /api/investigations/:id/messages`) | Save decoy message, generate contextual scammer reply, run full pipeline. Rate-limited per case. |
| `jaal.simulationNext` (`POST /api/investigations/:id/simulation/next`) | Advance the scripted arc. |
| `jaal.ingestMessages` | Bulk transcript import (content preserved verbatim). |
| `jaal.setRunStatus` (`POST .../pause|resume`) | Pause/resume the simulation. |
| `jaal.completeInvestigation` (`POST .../complete`) | Stop the run, auto-generate the final report. |
| `jaal.archiveInvestigation` (`POST .../archive`) | Archive without deleting evidence/reports. |
| `jaal.resetCase` / `jaal.seedDemo` / `jaal.resetDemo` | Demo lifecycle (reset restores the clean seeded demo state). |
| `jaal.generateHash` (`POST /api/evidence/:id/hash`) | On-demand SHA-256. |
| `jaal.verifyEvidence` (`POST /api/evidence/:id/verify`) | Recompute + compare → `match` / `mismatch` + integrity event. |
| `jaal.setEvidenceContent` | Tamper simulation for integrity demos (flags the record). |
| `jaal.setEvidenceNotes` (`PATCH /api/evidence/:id/notes`) | Analyst notes; never alters the hashed snapshot. |
| `jaal.generateReport` (`POST /api/investigations/:id/report`) | Build report from stored data. |
| `jaal.clearLogs` | Clear a case's console lines. |
| `jaal.updateSettings` (`PATCH /api/settings`) | Validated settings patch, persisted per owner. |

**Actions (LLM-augmented)**

| Function | Purpose |
| --- | --- |
| `actions.sendMessageWithAI` | Tries Claude for strategy/reply context, falls back to the simulation engine (labeled). |
| `actions.simulationNextWithAI` | Same for arc advancement. |
| `actions.approveStrategyWithAI` | Sends the approved (possibly edited) decoy question through the pipeline. |
| `actions.generateReportWithAI` | LLM report summary when configured, deterministic otherwise. |

All functions enforce owner authorization server-side; case-scoped mutations
resolve the investigation through the owner index and never trust a
client-claimed caseId alone.

## Testing

```bash
bun run test        # vitest run — 34 tests
```

- `src/services/pipeline.test.ts` — unit tests for tactic detection, kill-chain
  progression, identifier extraction (incl. dedupe + false-positive guards),
  SHA-256 (canonical test vector), tamper detection, strategy generation,
  simulation branching and report building.
- `src/convex/workflow.test.ts` — integration tests against the mock Convex
  runtime (`convex-test`): create → message → analyze → extract → hash →
  verify (match, then tamper → mismatch) → complete → report; plus
  dedupe across messages, per-case rate limiting, pause/resume, archive,
  settings persistence, demo seed/reset, and cross-owner authorization
  rejection.

The suite runs entirely without an external AI provider (simulation engine).

## Verifying the backend from the CLI

```bash
npx convex run jaal:seedDemo '{}'
npx convex run jaal:createInvestigation '{caseId:"JAAL-100",title:"Test",category:"Digital arrest scam",description:"d",notes:"n",source:"simulation",detectionMode:"simulation",flags:{tacticDetection:true,identifierExtraction:true,integrityHashing:true,aiSuggestions:true}}'
npx convex run actions:sendMessageWithAI '{caseId:"JAAL-100",text:"Which department is issuing this notice?"}'
npx convex run jaal:state '{}'
npx convex run jaal:resetDemo '{}'   # wipe + restore the clean demo cases
```

## Running locally

```bash
bun install
bun run dev        # Vite dev server (frontend + Convex via VITE_CONVEX_URL)
npx convex dev     # Convex dev process (pushes functions, syncs deployment)
bun run test       # backend + service test suite
bunx tsc -b --noEmit   # typecheck
```

No separate API server is required — Convex is the backend. Demo mode works
with zero configuration; add `ANTHROPIC_API_KEY` to enable the LLM engine.

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.


## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```


## Common Convex Mistakes To Avoid

When using convex, make sure:
- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.
