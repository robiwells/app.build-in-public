"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";

type CategoryFilterProps = {
  selectedCategory?: string;
};

export function CategoryFilter({ selectedCategory }: CategoryFilterProps) {
  const active = selectedCategory
    ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1).toLowerCase()
    : "All";

  const allCats = ["All", ...CATEGORIES] as const;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {allCats.map((cat) => {
        const href = cat === "All" ? "/" : `/?category=${cat.toLowerCase()}`;
        const isActive = cat === active;
        return (
          <Link
            key={cat}
            href={href}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
