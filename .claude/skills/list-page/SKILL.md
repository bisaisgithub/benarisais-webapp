---
name: list-page
description: Build or change an admin list page in this app — a paginated table with a search-all-fields box, per-column filters, an Add modal, per-row Edit, and edit history — following the Sites page as the reference implementation. Use this whenever the work touches /sites, /users, /courts, /time-ranges or a new page like them, and also whenever someone asks for a new admin screen, a CRUD page, a "list of X" with add/edit, a managed collection, or says "same as the sites page" / "follow the site page pattern". Use it even when they describe the feature only in domain terms ("a page to manage bookings", "let admins add coaches") without naming the pattern, since the conventions here — backend-only authorization, createdAt/createdBy/updateHistory, unique indexes, No.-first columns, filtering in the query rather than the browser — are easy to miss and expensive to retrofit.
---

# Admin list page

This app has four list pages — `/sites`, `/users`, `/courts`, `/time-ranges` —
that deliberately share one structure. New ones should match, so the codebase
stays predictable and so the security and audit conventions come along for
free rather than being re-derived each time.

`docs/list-page-pattern.md` is the specification. Read it before writing code;
it carries the conventions in detail with the reasoning behind each one. This
file is the order to work in.

## Work in this order

**1. Read the reference before writing anything.** Open
`docs/list-page-pattern.md`, then the Sites implementation it points at —
at minimum `src/app/sites/page.tsx`, `src/app/api/sites/route.ts` and
`src/app/api/sites/[id]/route.ts`. Copying a working page beats reconstructing
one from the description.

Also read the relevant guide in `node_modules/next/dist/docs/` — this is
Next.js 16 and its APIs differ from older versions.

**2. Settle the shape first.** Name the collection, its own fields, what makes
a row unique, and which columns the table shows. Getting this wrong is what
forces rework later, so if the request is ambiguous on any of them — and
especially on uniqueness — ask rather than guess.

**3. Reuse what is shared.** `HistoryModal`, `PageSizeSelect`, `ListFilters`,
`ColumnFilter`, `TableSearch`, `LocalDate` and everything in
`src/lib/updateHistory.ts` and `src/lib/listFilters.ts` are shared across all
four pages. Never fork them. Only the page, the two endpoints and the entity's
own modals are new.

**4. Build in this order**, checking each step compiles before the next:
index helper in `src/lib/mongodb.ts` → API routes → modals → page → navbar
link. Backend first means the page is built against endpoints that already
work.

**5. Verify before reporting done.** `npm run lint` and `npm run build` clean,
then exercise it — see Verifying below.

## The four things most easily got wrong

**Authorization is backend-only.** Both endpoints repeat
`getAuthenticatedUserId` then `isAdmin` on every request, before parsing the
body. The page gates its data fetch and renders "Admin access required."
Hiding a button in client code is presentation, never protection — anyone can
call the endpoint directly.

**Every collection carries `createdAt`, `createdBy` and `updateHistory`.**
History appends with `$slice: -10` and is skipped entirely when nothing
changed, so a no-op save cannot flush ten real edits out of the window.

**Uniqueness needs both halves.** A pre-insert `findOne` gives a readable 409;
the unique index behind it is what actually closes the race. Handle
`MongoServerError` code `11000` too.

**Filters belong in the query, not the browser.** The search box and every
column filter feed the same count and find that drive pagination, so the row
count and page count describe the filtered result. Count before clamping the
page, and make the pagination links carry the search and every filter.

**Filter state has one owner.** `ListFilters` holds every value on the page and
makes a single URL update. A component that pushes its own copy of the query
string will race the others and silently revert their values.

## Verifying

There is no MongoDB in the Claude Code web sandbox, and the network policy
blocks fetching one, so the database paths genuinely cannot run there. That is
a reason to be explicit, not to skip verification:

- Unauthenticated, every endpoint returns 401 and the page shows "Admin access
  required." This needs no database — the token check precedes any DB call —
  so it is always worth running against a real server.
- Validation, duplicate and not-found paths sit behind the admin check, so
  reaching them means temporarily stubbing the data layer. Drive the UI in a
  browser the same way.
- **Remove every stub before committing** and re-check the restored code runs.
  A stub that ships is worse than an unverified path.
- Say plainly which paths went unexercised. "Verified except the live database
  writes" is useful; implying full coverage is not.
