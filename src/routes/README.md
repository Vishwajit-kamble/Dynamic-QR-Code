# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File                     | URL                                                     |
| ------------------------ | ------------------------------------------------------- |
| `index.tsx`              | `/`                                                     |
| `about.tsx`              | `/about`                                                |
| `users/index.tsx`        | `/users`                                                |
| `users/$id.tsx`          | `/users/:id` (dynamic — bare `$`, no curly braces)      |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment)                  |
| `files/$.tsx`            | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx`            | layout route (renders children via `<Outlet />`)        |
| `__root.tsx`             | app shell — wraps every page; preserve `<Outlet />`     |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## Active Application Routes

| File            | URL           | Purpose                                                                      |
| --------------- | ------------- | ---------------------------------------------------------------------------- |
| `__root.tsx`    | _root shell_  | Global document layout, metadata, favicons, and React Query / Toaster setup  |
| `index.tsx`     | `/`           | QR Studio management workspace (overview analytics and QR card inventory)    |
| `r.$code.ts`    | `/r/:code`    | Public no-cache `302` redirect handler & scan telemetry recorder             |
| `api.health.ts` | `/api/health` | Storage readiness health check returning `200` (`ok: true`) or `503`         |
