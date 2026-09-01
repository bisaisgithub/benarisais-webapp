import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import AddSiteModal from "@/components/AddSiteModal";
import EditSiteModal from "@/components/EditSiteModal";
import HistoryModal from "@/components/HistoryModal";
import LocalDate from "@/components/LocalDate";
import PageSizeSelect from "@/components/PageSizeSelect";
import TableFilters from "@/components/TableFilters";
import { getAccessTokenFromCookieStore } from "@/lib/authCookies";
import { getAuthenticatedUserIdFromToken, isAdmin } from "@/lib/authz";
import { filterValue, textCondition } from "@/lib/listFilters";
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

interface SiteRecord {
  name: string;
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

  const nameFilter = filterValue(resolvedSearchParams.name);
  const hasFilters = Boolean(nameFilter);

  let sites: (SiteRecord & { _id: unknown })[] = [];
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
        const collection = db.collection<SiteRecord>("sites");

        const filter: Record<string, unknown> = {};
        if (nameFilter) {
          filter.name = textCondition(nameFilter);
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

  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    if (nameFilter) params.set("name", nameFilter);
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
            {!errorMessage && <AddSiteModal />}
            <PageSizeSelect pageSize={pageSize} basePath="/sites" />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
        ) : (
          <>
            {sites.length === 0 && !hasFilters ? (
              <p className="mt-8 text-sm text-foreground/60">No sites yet.</p>
            ) : (
              <>
                <div className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-foreground/10 bg-foreground/5">
                      <tr>
                        <th className="px-4 py-3 font-medium">No.</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Added</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                      <TableFilters
                        basePath="/sites"
                        columns={[
                          { key: "name", label: "name", placeholder: "Search name…" },
                          null,
                          null,
                        ]}
                        values={{ name: nameFilter }}
                      />
                    </thead>
                    <tbody>
                      {sites.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
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
                                <EditSiteModal id={id} name={site.name} />
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
