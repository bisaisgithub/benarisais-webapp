import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import EditUserModal from "@/components/EditUserModal";
import HistoryModal from "@/components/HistoryModal";
import LocalDate from "@/components/LocalDate";
import ListFilters from "@/components/ListFilters";
import PageSizeSelect from "@/components/PageSizeSelect";
import TableFilters from "@/components/TableFilters";
import TableSearch from "@/components/TableSearch";
import TypesModal from "@/components/TypesModal";
import { getAccessTokenFromCookieStore } from "@/lib/authCookies";
import { getAuthenticatedUserIdFromToken, isAdmin } from "@/lib/authz";
import {
  filterValue,
  textCondition,
} from "@/lib/listFilters";
import { getMongoClient } from "@/lib/mongodb";
import {
  actorIdsOf,
  actorName,
  resolveActorNames,
  toHistoryView,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin access required.";

interface UserRecord {
  name: string;
  email: string | null;
  contact: string | null;
  message: string;
  createdAt: Date;
  types?: unknown[];
  createdBy?: unknown;
  updateHistory?: UpdateHistoryEntry[];
}

interface UserTypeRecord {
  text: string;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default async function UsersPage(props: PageProps<"/users">) {
  const resolvedSearchParams = await props.searchParams;

  const pageSize = clamp(
    parsePositiveInt(
      firstValue(resolvedSearchParams.pageSize),
      DEFAULT_PAGE_SIZE,
    ),
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const requestedPage = parsePositiveInt(
    firstValue(resolvedSearchParams.page),
    1,
  );

  const search = filterValue(resolvedSearchParams.q);
  const filters = {
    name: filterValue(resolvedSearchParams.name),
    email: filterValue(resolvedSearchParams.email),
    contact: filterValue(resolvedSearchParams.contact),
    message: filterValue(resolvedSearchParams.message),
    type: filterValue(resolvedSearchParams.type),
  };
  const hasFilters = Boolean(search) || Object.values(filters).some(Boolean);

  let users: (UserRecord & { _id: unknown })[] = [];
  let userTypes: (UserTypeRecord & { _id: unknown })[] = [];
  let actorNames = new Map<string, string>();
  let total = 0;
  let page = requestedPage;
  let errorMessage: string | null = null;

  const authCheck = getAuthenticatedUserIdFromToken(
    getAccessTokenFromCookieStore(await cookies()),
  );

  if ("error" in authCheck) {
    errorMessage = ADMIN_ACCESS_REQUIRED_MESSAGE;
  } else {
    try {
      const client = await getMongoClient();
      const db = process.env.MONGODB_DB
        ? client.db(process.env.MONGODB_DB)
        : client.db();

      if (!(await isAdmin(db, authCheck.userId))) {
        errorMessage = ADMIN_ACCESS_REQUIRED_MESSAGE;
      } else {
        const collection = db.collection<UserRecord>("users");

        // types holds ids, so text has to be resolved to ids before it can
        // match. No match leaves an empty $in, which correctly matches no
        // user rather than every user.
        const typeIdsMatching = async (text: string) =>
          (
            await db
              .collection<UserTypeRecord>("user-types")
              .find({ text: textCondition(text) })
              .toArray()
          ).map((type) => type._id);

        const filter: Record<string, unknown> = {};
        for (const field of ["name", "email", "contact", "message"] as const) {
          if (filters[field]) {
            filter[field] = textCondition(filters[field]);
          }
        }
        if (filters.type) {
          filter.types = { $in: await typeIdsMatching(filters.type) };
        }
        if (search) {
          // One box across every field, for when you know a fragment but not
          // which column it is in. Types are resolved the same way as the
          // column filter, so a search for "admin" finds users by type too.
          filter.$or = [
            { name: textCondition(search) },
            { email: textCondition(search) },
            { contact: textCondition(search) },
            { message: textCondition(search) },
            { types: { $in: await typeIdsMatching(search) } },
          ];
        }

        // Counted with the filter applied, so the page count and the page
        // clamp below both describe the filtered result.
        total = await collection.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(requestedPage, totalPages);

        users = await collection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray();

        userTypes = await db
          .collection<UserTypeRecord>("user-types")
          .find()
          .sort({ text: 1 })
          .toArray();

        actorNames = await resolveActorNames(
          db,
          users.flatMap((user) => actorIdsOf(user)),
        );
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      errorMessage = "Could not load users. Please try again later.";
    }
  }

  const availableTypes = userTypes.map((type) => ({
    _id: String(type._id),
    text: type.text,
  }));
  const typeTextById = new Map(
    availableTypes.map((type) => [type._id, type.text]),
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRowNumber = (page - 1) * pageSize + 1;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    if (search) params.set("q", search);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return `/users?${params.toString()}`;
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Users
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {total} {total === 1 ? "registration" : "registrations"}
              {hasFilters ? " matching" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TypesModal />
            <PageSizeSelect pageSize={pageSize} />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
        ) : users.length === 0 && !hasFilters ? (
          <p className="mt-8 text-sm text-foreground/60">
            No registrations yet.
          </p>
        ) : (
          <>
            <ListFilters basePath="/users" initial={{ q: search, ...filters }}>
            <TableSearch />

            <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Types</th>
                    <th className="px-4 py-3 font-medium">Registered</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                  <TableFilters
                    columns={[
                      { key: "name", label: "name", placeholder: "Search name…" },
                      { key: "email", label: "email", placeholder: "Search email…" },
                      { key: "contact", label: "contact", placeholder: "Search contact…" },
                      { key: "message", label: "message", placeholder: "Search message…" },
                      { key: "type", label: "type", placeholder: "Search type…" },
                      null,
                      null,
                    ]}
                  />
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-6 text-center text-sm text-foreground/60"
                      >
                        No registrations match these filters.
                      </td>
                    </tr>
                  )}
                  {users.map((user, index) => {
                    const id = String(user._id);
                    const typeIds = (user.types ?? []).map((typeId) =>
                      String(typeId),
                    );
                    const typeTexts = typeIds
                      .map((typeId) => typeTextById.get(typeId))
                      .filter((text): text is string => Boolean(text));

                    return (
                      <tr
                        key={id}
                        className="border-b border-foreground/10 last:border-0"
                      >
                        <td className="px-4 py-3 text-foreground/60">
                          {firstRowNumber + index}
                        </td>
                        <td className="px-4 py-3">{user.name}</td>
                        <td className="px-4 py-3">{user.email ?? "—"}</td>
                        <td className="px-4 py-3">{user.contact ?? "—"}</td>
                        <td
                          className="max-w-xs truncate px-4 py-3"
                          title={user.message}
                        >
                          {user.message}
                        </td>
                        <td className="px-4 py-3">
                          {typeTexts.length === 0 ? (
                            "—"
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {typeTexts.map((text) => (
                                <span
                                  key={text}
                                  className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                                >
                                  {text}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground/60">
                          <LocalDate value={user.createdAt.toISOString()} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <EditUserModal
                              id={id}
                              name={user.name}
                              email={user.email}
                              contact={user.contact}
                              message={user.message}
                              typeIds={typeIds}
                              availableTypes={availableTypes}
                            />
                            <HistoryModal
                              title={user.name}
                              createdByName={actorName(
                                user.createdBy,
                                actorNames,
                                "Self-registered",
                              )}
                              createdAt={user.createdAt.toISOString()}
                              history={toHistoryView(
                                user.updateHistory,
                                actorNames,
                              )}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-foreground/60">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                  Previous
                </PageLink>
                <PageLink href={pageHref(page + 1)} disabled={page >= totalPages}>
                  Next
                </PageLink>
              </div>
            </div>
            </ListFilters>
          </>
        )}
      </div>
    </main>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-full border border-foreground/10 px-4 py-2 text-sm text-foreground/30">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-full border border-foreground/15 px-4 py-2 text-sm transition-colors hover:bg-foreground/10"
    >
      {children}
    </Link>
  );
}
