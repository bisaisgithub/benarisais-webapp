<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Adding an admin list page

`/sites`, `/users`, `/courts` and `/time-ranges` share one structure. Before
adding or changing a list page with add/edit/history, read
`docs/list-page-pattern.md` and follow the Sites implementation it points at.

Two rules that are easy to get wrong: authorization is enforced in the API
routes and the page's data fetch only — never in client code — and every
collection carries `createdAt`, `createdBy` and an `updateHistory` capped at
ten entries.
