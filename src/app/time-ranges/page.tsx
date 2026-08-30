import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import HistoryModal from "@/components/HistoryModal";
import PageSizeSelect from "@/components/PageSizeSelect";
import TimeRangeModal from "@/components/TimeRangeModal";
import { getAccessTokenFromCookieStore } from "@/lib/authCookies";
import { getAuthenticatedUserIdFromToken, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";
import {
  crossesMidnight,
  durationMinutes,
  formatDuration,
  formatInterval,
  formatTime,
} from "@/lib/timeRanges";
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

interface TimeRangeRecord {
  interval: number;
  startMinutes: number;
  endMinutes: number;
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

export default async function TimeRangesPage(
  props: PageProps<"/time-ranges">,
) {
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

  let ranges: (TimeRangeRecord & { _id: unknown })[] = [];
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
        const collection = db.collection<TimeRangeRecord>("time-ranges");

        total = await collection.countDocuments();
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(requestedPage, totalPages);

        ranges = await collection
          .find()
          .sort({ startMinutes: 1, endMinutes: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray();

        actorNames = await resolveActorNames(
          db,
          ranges.flatMap((range) => actorIdsOf(range)),
        );
      }
    } catch (error) {
      console.error("Failed to load time ranges:", error);
      errorMessage = "Could not load time ranges. Please try again later.";
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRowNumber = (page - 1) * pageSize + 1;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Time Ranges
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              {total} {total === 1 ? "time range" : "time ranges"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!errorMessage && <TimeRangeModal />}
            <PageSizeSelect pageSize={pageSize} basePath="/time-ranges" />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
        ) : ranges.length === 0 ? (
          <p className="mt-8 text-sm text-foreground/60">No time ranges yet.</p>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Interval</th>
                    <th className="px-4 py-3 font-medium">Start</th>
                    <th className="px-4 py-3 font-medium">End</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((range, index) => {
                    const id = String(range._id);
                    const start = formatTime(range.startMinutes);
                    const end = formatTime(range.endMinutes);
                    const overnight = crossesMidnight(
                      range.startMinutes,
                      range.endMinutes,
                    );

                    return (
                      <tr
                        key={id}
                        className="border-b border-foreground/10 last:border-0"
                      >
                        <td className="px-4 py-3 text-foreground/60">
                          {firstRowNumber + index}
                        </td>
                        <td className="px-4 py-3">
                          {formatInterval(range.interval)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{start}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {end}
                          {overnight && (
                            <span
                              title="Ends the next day"
                              className="ml-1 text-xs text-foreground/60"
                            >
                              +1d
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground/60">
                          {formatDuration(
                            durationMinutes(
                              range.startMinutes,
                              range.endMinutes,
                            ),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TimeRangeModal
                              range={{
                                _id: id,
                                interval: range.interval,
                                start,
                                end,
                              }}
                            />
                            <HistoryModal
                              title={`${start} – ${end}`}
                              createdByName={actorName(
                                range.createdBy,
                                actorNames,
                              )}
                              createdAt={
                                range.createdAt
                                  ? range.createdAt.toISOString()
                                  : null
                              }
                              history={toHistoryView(
                                range.updateHistory,
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
                <PageLink
                  page={page - 1}
                  pageSize={pageSize}
                  disabled={page <= 1}
                >
                  Previous
                </PageLink>
                <PageLink
                  page={page + 1}
                  pageSize={pageSize}
                  disabled={page >= totalPages}
                >
                  Next
                </PageLink>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function PageLink({
  page,
  pageSize,
  disabled,
  children,
}: {
  page: number;
  pageSize: number;
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
      href={`/time-ranges?page=${page}&pageSize=${pageSize}`}
      className="rounded-full border border-foreground/15 px-4 py-2 text-sm transition-colors hover:bg-foreground/10"
    >
      {children}
    </Link>
  );
}
