# List page pattern

The admin list pages (`/sites`, `/users`, `/courts`, `/time-ranges`) are all
built the same way. **Sites is the reference implementation** — when adding a
new one, read those files and follow them rather than inventing a shape.

## Reference files

| Concern | File |
| --- | --- |
| List page (server component) | `src/app/sites/page.tsx` |
| Create endpoint | `src/app/api/sites/route.ts` |
| Update endpoint | `src/app/api/sites/[id]/route.ts` |
| Add modal | `src/components/AddSiteModal.tsx` |
| Edit modal | `src/components/EditSiteModal.tsx` |
| History modal (shared, do not fork) | `src/components/HistoryModal.tsx` |
| Page-size control (shared) | `src/components/PageSizeSelect.tsx` |
| Column filter funnel (shared) | `src/components/ColumnFilter.tsx` |
| Search-all-fields box (shared) | `src/components/TableSearch.tsx` |
| Filter state owner (shared) | `src/components/ListFilters.tsx` |
| Filter condition builders (shared) | `src/lib/listFilters.ts` |
| History helpers (shared) | `src/lib/updateHistory.ts` |
| Index setup | `src/lib/mongodb.ts` |
| Nav links | `src/components/Navbar.tsx` |

`HistoryModal`, `PageSizeSelect`, `ListFilters`, `ColumnFilter`, `TableSearch`,
`LocalDate` and everything in `src/lib/updateHistory.ts` and
`src/lib/listFilters.ts` are shared. Reuse them; only the page, the two
endpoints and the two entity-specific modals are new per feature.

## Document shape

Every collection carries the same three fields alongside its own:

```ts
{
  // ...the entity's own fields
  createdAt: Date,
  createdBy: ObjectId | null,   // ref to users
  updateHistory: UpdateHistoryEntry[],
}
```

Add an `ensureXIndexes()` to `src/lib/mongodb.ts` for any uniqueness the
entity needs, following `ensureSiteIndexes`: memoised per process, dev copy on
`globalThis`, and failures logged rather than thrown so a pre-existing
duplicate cannot take the app down.

## Security

**Authorization is enforced in the backend only. Never gate in client code.**

Both endpoints repeat the same two checks on every request, in this order —
auth, then admin, then parse, then validate:

```ts
const authCheck = getAuthenticatedUserId(request);
if ("error" in authCheck) return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });

const db = await getDb();
if (!(await isAdmin(db, authCheck.userId))) {
  return NextResponse.json({ error: "Admin access required." }, { status: 403 });
}
```

The admin check comes **before** body validation on purpose, so a non-admin
learns nothing about the payload rules.

The page gates its **data fetch**, not the route — it renders
`"Admin access required."` in place of the table:

```ts
const authCheck = getAuthenticatedUserIdFromToken(
  getAccessTokenFromCookieStore(await cookies()),
);
```

The Add button is hidden when that check fails, but that is presentation
only — the endpoint is what actually protects the data.

## Endpoints

- `POST /api/<entity>` creates. `PUT /api/<entity>/[id]` updates. Validate the
  id with `ObjectId.isValid` and return 400 before touching the database.
- Trim strings. Reject blanks with 400 and a message an admin can act on.
- For uniqueness: a pre-insert `findOne` gives a readable 409, and the unique
  index behind it closes the race. Catch `MongoServerError` code `11000` and
  return the same 409, since the index is the real guard.
- Record history on update — never on create, where `createdBy` already says
  who:

```ts
const current = await collection.findOne({ _id: objectId });
const changes = diffChanges({ name: current.name }, { name: trimmedName });

await collection.updateOne({ _id: objectId }, {
  $set: { name: trimmedName },
  // Skipped when nothing moved, so a no-op save can't push real edits
  // out of the capped history.
  ...(Object.keys(changes).length > 0
    ? { $push: pushUpdateHistory(authCheck.userId, changes) }
    : {}),
});
```

`pushUpdateHistory` appends with `$slice: -10`, keeping the newest ten. Record
values as they read on screen, not as ids — user types are stored by their
text, times by their `HH:MM` — so history stays legible after a rename.

If the collection is untyped, `$push` will not typecheck. Type it:
`db.collection<XDocument>(COLLECTION_NAME)`.

## Page

- `PageProps<"/route">`, `searchParams` awaited, page size clamped 1–100 with
  a default of 10.
- Resolve every actor id on the page in **one** query, never per row:

```ts
actorNames = await resolveActorNames(db, rows.flatMap((row) => actorIdsOf(row)));
```

- Table columns are **No. first, Actions last**. `No.` is the row's position
  in the full result, not the page: `const firstRowNumber = (page - 1) * pageSize + 1`.
- Actions hold `<EditXModal />` then `<HistoryModal />` in a `flex gap-2`.
- Pass `basePath="/your-route"` to `PageSizeSelect`.
- Give the table a `min-w-[…]` wide enough for its columns, inside
  `overflow-x-auto`, so it scrolls rather than crushing cells on a phone.
- `actorName(id, actorNames)` falls back to `"Unknown"`. Pass
  `"Self-registered"` as the third argument only on users, who have no
  creating admin.

## Filtering

Every list carries a filter row under its headers — one search box per
filterable column, the way a spreadsheet filters a column.

**Filter in the query, never in the browser.** A client-side filter can only
narrow the rows already fetched, so it silently disagrees with the row count
and misses everything on page two. Feed the filters into the same
`countDocuments`/`find` (or `$match`, where the page aggregates) that drives
the page:

```tsx
const filters = { name: filterValue(resolvedSearchParams.name) };
const hasFilters = Object.values(filters).some(Boolean);

const filter: Record<string, unknown> = {};
if (filters.name) filter.name = textCondition(filters.name);

total = await collection.countDocuments(filter);          // filtered count
const totalPages = Math.max(1, Math.ceil(total / pageSize));
page = Math.min(requestedPage, totalPages);               // clamp after
```

Count **before** clamping the page. Clamping first hands back an empty page
whenever a filter shortens the result below the reader's current page.

`src/lib/listFilters.ts` has the condition builders: `textCondition` for a
case-insensitive substring, `numberCondition` for an exact number,
`timeCondition` for times stored as minutes. Each returns `MATCHES_NOTHING`
for input it cannot read, rather than dropping the filter — showing rows the
reader believes they excluded is worse than an empty table they can see.

A filter over a referenced collection resolves through it first: the users
page turns a typed type name into ids, then matches `types: { $in: ids }`.

### Search all fields

A `q` parameter matched against every field at once, for when you know a
fragment but not which column it is in. Build it as an `$or` over the
entity's fields, and resolve references the same way the column filter does:

```ts
if (search) {
  filter.$or = [
    { name: textCondition(search) },
    { email: textCondition(search) },
    { types: { $in: await typeIdsMatching(search) } },
  ];
}
```

Branches that cannot read the term match nothing rather than erroring, so a
numeric field and a text field can sit in the same `$or` safely.

### On the page

- Wrap the whole table region in
  `<ListFilters basePath="/route" initial={{ q: search, ...filters }}>`.
- Render `<TableSearch />` above the table.
- Put `<ColumnFilter column={…} />` beside each filterable column's heading.
  Keep the column definitions in a `const X_FILTER_COLUMNS` beside the page's
  other constants and map over it, so headings and filters cannot drift apart.
- Keep the table rendered when a filter matches nothing, with a message row in
  the `<tbody>` — hiding it takes the filter controls away and leaves no way
  to undo the filter. Only fall back to "No X yet." when nothing is filtered.
- Pagination links must carry every filter and the search, or paging silently
  clears them. Use a `pageHref(targetPage)` helper, not a hardcoded string.

**One owner, one push.** `ListFilters` holds every filter value on the page
and writes them as a single URL update. Do not give a filter component its own
push: when two components each pushed the whole query string, two changes
inside one debounce window raced — `router.push` is async, so the second read a
URL the first had not yet updated and silently reverted it, leaving an input
showing one value and the table another.

**A filter behind an icon has to announce itself.** An active funnel is filled
and drawn in the accent colour and names its value in the tooltip, and the
count above the table reads "N matching". Each control clears only what it
shows, so no button silently wipes another's value.

**Panels are portalled and positioned against the viewport**, since the table
sits in an overflow container that would clip a panel dropping out of a
heading. They follow their button on scroll rather than closing — closing was
wrong, because clicking a funnel in a partly off-screen column makes the
browser scroll the table to reveal it, and that scroll arrives after the panel
opens, so the first click appeared to do nothing.

## Modals

Modals are portalled to `document.body` at `z-[60]`; `HistoryModal` sits at
`z-[70]` so it can open from inside another modal.

Sites keeps add and edit as two components (`AddSiteModal`, `EditSiteModal`)
because each is a short form. Time ranges uses a single `TimeRangeModal` for
both, taking an optional existing record, because that form has three fields
and a live readout worth writing once. Either is fine — split when the forms
are trivial, share when duplicating would mean maintaining the same form
twice.

Whichever way, each modal:

- resets its state in `openModal()`, so reopening never shows stale input;
- validates client-side for fast feedback, and surfaces the server's `error`
  message verbatim on failure — the server is the authority;
- calls `router.refresh()` after a successful save;
- closes on the backdrop, on Cancel, and on ✕.

A form whose values sit on a grid (times, steps) must **snap the value**, not
just set an `step` attribute — `step` does not constrain typed input.

## Nav

Add a `<Link>` in `src/components/Navbar.tsx` inside `<MobileMenu>`, matching
the existing pill classes, so it appears in the mobile panel too.

## Before saying it works

- `npm run lint` and `npm run build` both clean.
- Unauthenticated: every endpoint returns 401 and the page shows
  `"Admin access required."`
- Each validation and duplicate path returns the status and message intended.
- The modal drives correctly in a browser: add, edit, cancel, duplicate error,
  and the history modal opening from a row.
- Filters narrow the count and the page count and survive paging; the search
  box matches on each field in turn; both compose rather than replacing each
  other. Check a filter panel opens on the first click in a column that starts
  off-screen at 375px wide.

There is no MongoDB in the Claude Code web sandbox and its network policy
blocks one being fetched, so the database paths cannot be exercised there.
Verify the rest by stubbing the data layer, **remove every stub before
committing**, and say plainly which paths went unverified.
