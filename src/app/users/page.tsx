import Link from "next/link";
import type { ReactNode } from "react";
import EditUserModal from "@/components/EditUserModal";
import LocalDate from "@/components/LocalDate";
import PageSizeSelect from "@/components/PageSizeSelect";
import TypesModal from "@/components/TypesModal";
import { getMongoClient } from "@/lib/mongodb";

const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

interface UserRecord {
  name: string;
  email: string | null;
  contact: string | null;
  message: string;
  createdAt: Date;
  types?: unknown[];
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

  let users: (UserRecord & { _id: unknown })[] = [];
  let userTypes: (UserTypeRecord & { _id: unknown })[] = [];
  let total = 0;
  let page = requestedPage;
  let errorMessage: string | null = null;

  try {
    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();
    const collection = db.collection<UserRecord>("users");

    total = await collection.countDocuments();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(requestedPage, totalPages);

    users = await collection
      .find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    userTypes = await db
      .collection<UserTypeRecord>("user-types")
      .find()
      .sort({ text: 1 })
      .toArray();
  } catch (error) {
    console.error("Failed to load users:", error);
    errorMessage = "Could not load users. Please try again later.";
  }

  const availableTypes = userTypes.map((type) => ({
    _id: String(type._id),
    text: type.text,
  }));
  const typeTextById = new Map(
    availableTypes.map((type) => [type._id, type.text]),
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TypesModal />
            <PageSizeSelect pageSize={pageSize} />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-8 text-sm text-red-500">{errorMessage}</p>
        ) : users.length === 0 ? (
          <p className="mt-8 text-sm text-foreground/60">
            No registrations yet.
          </p>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-foreground/10 bg-foreground/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Types</th>
                    <th className="px-4 py-3 font-medium">Registered</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
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
                          <EditUserModal
                            id={id}
                            name={user.name}
                            email={user.email}
                            contact={user.contact}
                            message={user.message}
                            typeIds={typeIds}
                            availableTypes={availableTypes}
                          />
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
      href={`/users?page=${page}&pageSize=${pageSize}`}
      className="rounded-full border border-foreground/15 px-4 py-2 text-sm transition-colors hover:bg-foreground/10"
    >
      {children}
    </Link>
  );
}
