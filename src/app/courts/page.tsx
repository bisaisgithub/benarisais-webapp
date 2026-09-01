import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import AddCourtsModal from "@/components/AddCourtsModal";
import TableFilters from "@/components/TableFilters";
import ListFilters from "@/components/ListFilters";
import PageSizeSelect from "@/components/PageSizeSelect";
import { getAccessTokenFromCookieStore } from "@/lib/authCookies";
import { getAuthenticatedUserIdFromToken, isAdmin } from "@/lib/authz";
import {
  filterValue,
  numberCondition,
  textCondition,
} from "@/lib/listFilters";
import { getMongoClient } from "@/lib/mongodb";

const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin access required.";

interface CourtRow {
  _id: unknown;
  number: number;
  siteName: string | null;
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




export default async function CourtsPage(props: PageProps<"/courts">) {
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

  const siteFilter = filterValue(resolvedSearchParams.site);
  const numberFilter = filterValue(resolvedSearchParams.number);
  const hasFilters = Boolean(siteFilter || numberFilter);

  let courts: CourtRow[] = [];
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
        const collection = db.collection("courts");

        const match: Record<string, unknown> = {};
        if (siteFilter) {
          match["site.name"] = textCondition(siteFilter);
        }
        if (numberFilter) {
          match.number = numberCondition(numberFilter);
        }

        // Joined to sites so the list can be ordered and filtered by site
        // name — sorting on siteId alone would order by ObjectId, which
        // reads as arbitrary.
        const pipeline: Record<string, unknown>[] = [
          {
            $lookup: {
              from: "sites",
              localField: "siteId",
              foreignField: "_id",
              as: "site",
            },
          },
          {
            $unwind: {
              path: "$site",
              preserveNullAndEmptyArrays: true,
            },
          },
          ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
        ];

        // Counted first so the page can be clamped against the filtered
        // total; clamping afterwards would hand back an empty page whenever
        // a filter shortens the result below the current page.
        const counted = await collection
          .aggregate<{ total: number }>([...pipeline, { $count: "total" }])
          .toArray();
        total = counted[0]?.total ?? 0;

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(requestedPage, totalPages);

        courts = await collection
          .aggregate<CourtRow>([
            ...pipeline,
            { $sort: { "site.name": 1, number: 1 } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                number: 1,
                siteName: { $ifNull: ["$site.name", null] },
              },
            },
          ])
          .toArray();
      }
    } catch (error) {
      console.error("Failed to load courts:", error);
      errorMessage = "Could not load courts. Please try again later.";
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRowNumber = (page - 1) * pageSize + 1;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    if (siteFilter) params.set("site", siteFilter);
    if (numberFilter) params.set("number", numberFilter);
    return `/courts?${params.toString()}`;
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Courts
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {total} {total === 1 ? "court" : "courts"}
              {hasFilters ? " matching" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!errorMessage && <AddCourtsModal />}
            <PageSizeSelect pageSize={pageSize} basePath="/courts" />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
        ) : courts.length === 0 && !hasFilters ? (
          <p className="mt-8 text-sm text-foreground/60">No courts yet.</p>
        ) : (
          <>
            <ListFilters basePath="/courts" initial={{ site: siteFilter, number: numberFilter }}>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Court No.</th>
                  </tr>
                  <TableFilters
                    columns={[
                      { key: "site", label: "site", placeholder: "Search site…" },
                      { key: "number", label: "court number", placeholder: "Court no…" },
                    ]}
                  />
                </thead>
                <tbody>
                  {courts.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-sm text-foreground/60"
                      >
                        No courts match these filters.
                      </td>
                    </tr>
                  )}
                  {courts.map((court, index) => (
                    <tr
                      key={String(court._id)}
                      className="border-b border-foreground/10 last:border-0"
                    >
                      <td className="px-4 py-3 text-foreground/60">
                        {firstRowNumber + index}
                      </td>
                      <td className="px-4 py-3">{court.siteName ?? "—"}</td>
                      <td className="px-4 py-3">{court.number}</td>
                    </tr>
                  ))}
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
