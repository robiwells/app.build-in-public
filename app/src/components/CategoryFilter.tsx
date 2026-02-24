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
                ? "bg-[#b5522a] text-white"
                : "border border-[#e8ddd0] text-[#78716c] hover:border-[#c9b99a]"
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
