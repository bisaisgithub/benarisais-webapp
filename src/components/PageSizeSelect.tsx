"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", event.target.value);
    params.set("page", "1");
    router.push(`/users?${params.toString()}`);
  }

  const options = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);

  return (
    <label className="flex items-center gap-2 text-sm text-foreground/70">
      Per page
      <select
        value={pageSize}
        onChange={handleChange}
        className="rounded-lg border border-foreground/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
