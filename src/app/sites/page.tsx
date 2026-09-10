import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import AddSiteModal from "@/components/AddSiteModal";
import EditSiteModal from "@/components/EditSiteModal";
import HistoryModal from "@/components/HistoryModal";
import LocalDate from "@/components/LocalDate";
import ListFilters from "@/components/ListFilters";
import PageSizeSelect from "@/components/PageSizeSelect";
import SessionRecovery from "@/components/SessionRecovery";
import TableSearch from "@/components/TableSearch";
import TypesModal from "@/components/TypesModal";
import ColumnFilter from "@/components/ColumnFilter";
import { getAccessTokenFromCookieStore } from "@/lib/authCookies";
import { getAuthenticatedUserIdFromToken, isAdmin } from "@/lib/authz";
import { filterValue, textCondition } from "@/lib/listFilters";
import { ObjectId } from "mongodb";
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
// src/proxy.ts renews a lapsed access token before this page renders, so a
// token that still fails here means the session is genuinely over — not that
// the account lacks admin rights.
const SESSION_ENDED_MESSAGE = "Your session has ended. Please sign in again.";

/** Filterable columns, in table order. The key is also the URL parameter. */
const SITE_FILTER_COLUMNS = [
  { heading: "Name", column: { key: "name", label: "name", placeholder: "Search name…" } },
  { heading: "Type", column: { key: "type", label: "type", placeholder: "Search type…" } },
] as const;

interface SiteRecord {
  name: string;
  /** Reference into siteTypes; absent on sites saved before types existed. */
  type?: unknown;
  createdAt?: Date;
  createdBy?: unknown;
  updateHistory?: UpdateHistoryEntry[];
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

export default async function SitesPage(props: PageProps<"/sites">) {
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
  const nameFilter = filterValue(resolvedSearchParams.name);
  const typeFilter = filterValue(resolvedSearchParams.type);
  const hasFilters = Boolean(search || nameFilter || typeFilter);

  let sites: (SiteRecord & { _id: unknown })[] = [];
  let actorNames = new Map<string, string>();
  let siteTypes: { _id: string; text: string }[] = [];
  let total = 0;
  let page = requestedPage;
  let errorMessage: string | null = null;
  // True only when the access token itself failed, which a refresh can fix.
  let sessionExpired = false;

  const authCheck = getAuthenticatedUserIdFromToken(
    getAccessTokenFromCookieStore(await cookies()),
  );

  if ("error" in authCheck) {
    errorMessage = SESSION_ENDED_MESSAGE;
    sessionExpired = true;
  } else {
    try {
      const client = await getMongoClient();
      const db = process.env.MONGODB_DB
        ? client.db(process.env.MONGODB_DB)
        : client.db();

      if (!(await isAdmin(db, authCheck.userId))) {
        errorMessage = ADMIN_ACCESS_REQUIRED_MESSAGE;
      } else {
        const collection = db.collection<SiteRecord>("sites");

        siteTypes = (
          await db
            .collection<{ text: string }>("siteTypes")
            .find()
            .sort({ text: 1 })
            .toArray()
        ).map((siteType) => ({
          _id: siteType._id.toString(),
          text: siteType.text,
        }));

        const filter: Record<string, unknown> = {};
        if (nameFilter) {
          filter.name = textCondition(nameFilter);
        }
        if (typeFilter) {
          // The column holds a reference, so the typed text is resolved to
          // ids first. No match leaves an empty $in, which correctly returns
          // no sites rather than every site.
          filter.type = {
            $in: siteTypes
              .filter((siteType) =>
                siteType.text.toLowerCase().includes(typeFilter.toLowerCase()),
              )
              .map((siteType) => new ObjectId(siteType._id)),
          };
        }
        if (search) {
          filter.$or = [
            { name: textCondition(search) },
            {
              type: {
                $in: siteTypes
                  .filter((siteType) =>
                    siteType.text.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((siteType) => new ObjectId(siteType._id)),
              },
            },
          ];
        }

        // Counted with the filter applied, so the page count and the page
        // clamp below both describe the filtered result.
        total = await collection.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(requestedPage, totalPages);

        sites = await collection
          .find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray();

        actorNames = await resolveActorNames(
          db,
          sites.flatMap((site) => actorIdsOf(site)),
        );
      }
    } catch (error) {
      console.error("Failed to load sites:", error);
      errorMessage = "Could not load sites. Please try again later.";
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRowNumber = (page - 1) * pageSize + 1;
  const typeTextById = new Map(
    siteTypes.map((siteType) => [siteType._id, siteType.text]),
  );

  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    if (search) params.set("q", search);
    if (nameFilter) params.set("name", nameFilter);
    if (typeFilter) params.set("type", typeFilter);
    return `/sites?${params.toString()}`;
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Sites
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {total} {total === 1 ? "site" : "sites"}
              {hasFilters ? " matching" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!errorMessage && (
              <>
                <TypesModal
                  endpoint="/api/sites/types"
                  title="Site Types"
                />
                <AddSiteModal />
              </>
            )}
            <PageSizeSelect pageSize={pageSize} basePath="/sites" />
          </div>
        </div>

        {errorMessage ? (
          <>
            <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
            {sessionExpired && <SessionRecovery />}
          </>
        ) : (
          <>
            <ListFilters basePath="/sites" initial={{ q: search, name: nameFilter, type: typeFilter }}>
            {sites.length === 0 && !hasFilters ? (
              <p className="mt-8 text-sm text-foreground/60">No sites yet.</p>
            ) : (
              <>
                <TableSearch />

                <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-foreground/10 bg-foreground/5">
                      <tr>
                        <th className="px-4 py-3 font-medium">No.</th>
                        {SITE_FILTER_COLUMNS.map(({ heading, column }) => (
                          <th
                            key={heading}
                            className="whitespace-nowrap px-4 py-3 font-medium"
                          >
                            {heading}
                            <ColumnFilter column={column} />
                          </th>
                        ))}
                        <th className="px-4 py-3 font-medium">Added</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-sm text-foreground/60"
                          >
                            No sites match these filters.
                          </td>
                        </tr>
                      )}
                      {sites.map((site, index) => {
                        const id = String(site._id);

                        return (
                          <tr
                            key={id}
                            className="border-b border-foreground/10 last:border-0"
                          >
                            <td className="px-4 py-3 text-foreground/60">
                              {firstRowNumber + index}
                            </td>
                            <td className="px-4 py-3">{site.name}</td>
                            <td className="px-4 py-3">
                              {typeTextById.get(String(site.type)) ?? (
                                <span className="text-foreground/40">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-foreground/60">
                              {site.createdAt ? (
                                <LocalDate
                                  value={site.createdAt.toISOString()}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <EditSiteModal
                                  id={id}
                                  name={site.name}
                                  type={site.type ? String(site.type) : ""}
                                  typeText={
                                    site.type
                                      ? (typeTextById.get(String(site.type)) ??
                                        "")
                                      : ""
                                  }
                                />
                                <HistoryModal
                                  title={site.name}
                                  createdByName={actorName(
                                    site.createdBy,
                                    actorNames,
                                  )}
                                  createdAt={
                                    site.createdAt
                                      ? site.createdAt.toISOString()
                                      : null
                                  }
                                  history={toHistoryView(
                                    site.updateHistory,
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
                    <PageLink
                      href={pageHref(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                    </PageLink>
                  </div>
                </div>
              </>
            )}
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
