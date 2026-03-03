"use client";

import type { NotionBlock, NotionPageMeta, NotionRichText } from "@/lib/notion";

// ── Rich Text ─────────────────────────────────────────────────────────────────

function RichText({ items }: { items: NotionRichText[] }) {
  return (
    <>
      {items.map((item, i) => {
        const { annotations, plain_text, href } = item;
        let content: React.ReactNode = plain_text;

        if (annotations.code) {
          content = (
            <code className="rounded bg-[#f0ebe3] px-1 py-0.5 font-mono text-sm text-[#b5522a]">
              {content}
            </code>
          );
        } else {
          if (annotations.bold) content = <strong>{content}</strong>;
          if (annotations.italic) content = <em>{content}</em>;
          if (annotations.strikethrough) content = <s>{content}</s>;
          if (annotations.underline) content = <u>{content}</u>;
        }

        if (href) {
          content = (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b5522a] underline hover:opacity-80"
            >
              {content}
            </a>
          );
        }

        return <span key={i}>{content}</span>;
      })}
    </>
  );
}

function richTextFrom(block: NotionBlock, key: string): NotionRichText[] {
  const inner = block[block.type] as Record<string, unknown> | undefined;
  if (!inner) return [];
  const arr = inner[key] as NotionRichText[] | undefined;
  return arr ?? [];
}

// ── Block renderer ─────────────────────────────────────────────────────────────

function Block({ block }: { block: NotionBlock }) {
  const type = block.type;

  if (type === "paragraph") {
    const items = richTextFrom(block, "rich_text");
    return (
      <p className="my-2 leading-relaxed text-[#2a1f14]">
        <RichText items={items} />
      </p>
    );
  }

  if (type === "heading_1") {
    return (
      <h2 className="mt-6 mb-2 font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#2a1f14]">
        <RichText items={richTextFrom(block, "rich_text")} />
      </h2>
    );
  }

  if (type === "heading_2") {
    return (
      <h3 className="mt-5 mb-2 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14]">
        <RichText items={richTextFrom(block, "rich_text")} />
      </h3>
    );
  }

  if (type === "heading_3") {
    return (
      <h4 className="mt-4 mb-1 font-semibold text-[#2a1f14]">
        <RichText items={richTextFrom(block, "rich_text")} />
      </h4>
    );
  }

  if (type === "bulleted_list_item") {
    return (
      <li className="ml-5 list-disc leading-relaxed text-[#2a1f14]">
        <RichText items={richTextFrom(block, "rich_text")} />
        {block.children && block.children.length > 0 && (
          <ul className="mt-1">
            <BlockList blocks={block.children} />
          </ul>
        )}
      </li>
    );
  }

  if (type === "numbered_list_item") {
    return (
      <li className="ml-5 list-decimal leading-relaxed text-[#2a1f14]">
        <RichText items={richTextFrom(block, "rich_text")} />
        {block.children && block.children.length > 0 && (
          <ol className="mt-1">
            <BlockList blocks={block.children} />
          </ol>
        )}
      </li>
    );
  }

  if (type === "to_do") {
    const inner = block.to_do as Record<string, unknown> | undefined;
    const checked = (inner?.checked as boolean) ?? false;
    return (
      <label className="flex items-start gap-2 py-0.5 text-[#2a1f14]">
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mt-1 h-4 w-4 shrink-0 rounded border-[#c9b99a] accent-[#b5522a]"
          readOnly
        />
        <span className={checked ? "line-through text-[#a8a29e]" : ""}>
          <RichText items={richTextFrom(block, "rich_text")} />
        </span>
      </label>
    );
  }

  if (type === "toggle") {
    return (
      <details className="my-2 rounded-lg border border-[#e8ddd0] bg-[#faf7f2]">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-[#2a1f14] hover:bg-[#f5f0e8]">
          <RichText items={richTextFrom(block, "rich_text")} />
        </summary>
        {block.children && block.children.length > 0 && (
          <div className="border-t border-[#e8ddd0] px-3 py-2">
            <BlockList blocks={block.children} />
          </div>
        )}
      </details>
    );
  }

  if (type === "code") {
    const inner = block.code as Record<string, unknown> | undefined;
    const lang = (inner?.language as string) ?? "";
    const items = richTextFrom(block, "rich_text");
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-[#e8ddd0]">
        {lang && (
          <div className="bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#78716c]">
            {lang}
          </div>
        )}
        <pre className="overflow-x-auto bg-[#faf7f2] p-3 font-mono text-sm text-[#2a1f14]">
          <code>{items.map((t) => t.plain_text).join("")}</code>
        </pre>
      </div>
    );
  }

  if (type === "quote") {
    return (
      <blockquote className="my-3 border-l-4 border-[#c9b99a] pl-4 text-[#78716c] italic">
        <RichText items={richTextFrom(block, "rich_text")} />
      </blockquote>
    );
  }

  if (type === "callout") {
    const inner = block.callout as Record<string, unknown> | undefined;
    const iconObj = inner?.icon as Record<string, unknown> | null | undefined;
    const emoji = iconObj?.type === "emoji" ? (iconObj.emoji as string) : "💡";
    return (
      <div className="my-3 flex gap-3 rounded-lg border border-[#e8ddd0] bg-[#faf7f2] px-4 py-3">
        <span className="shrink-0 text-lg leading-relaxed">{emoji}</span>
        <span className="leading-relaxed text-[#2a1f14]">
          <RichText items={richTextFrom(block, "rich_text")} />
        </span>
      </div>
    );
  }

  if (type === "divider") {
    return <hr className="my-4 border-[#e8ddd0]" />;
  }

  if (type === "image") {
    const inner = block.image as Record<string, unknown> | undefined;
    const imgType = inner?.type as string | undefined;
    const src =
      imgType === "external"
        ? ((inner?.external as Record<string, unknown>)?.url as string | undefined)
        : ((inner?.file as Record<string, unknown>)?.url as string | undefined);
    const caption = richTextFrom(block, "caption");
    if (!src) return null;
    return (
      <figure className="my-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption.map((t) => t.plain_text).join("") || ""}
          className="w-full rounded-lg object-cover"
        />
        {caption.length > 0 && (
          <figcaption className="mt-1 text-center text-xs text-[#a8a29e]">
            <RichText items={caption} />
          </figcaption>
        )}
      </figure>
    );
  }

  if (type === "bookmark") {
    const inner = block.bookmark as Record<string, unknown> | undefined;
    const url = inner?.url as string | undefined;
    const caption = richTextFrom(block, "caption");
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="my-3 flex items-center gap-2 rounded-lg border border-[#e8ddd0] px-4 py-3 text-sm text-[#b5522a] hover:bg-[#faf7f2] hover:underline"
      >
        <span className="truncate">
          {caption.length > 0 ? <RichText items={caption} /> : url}
        </span>
        <span className="shrink-0 text-[#a8a29e]">↗</span>
      </a>
    );
  }

  if (type === "child_page") {
    const inner = block.child_page as Record<string, unknown> | undefined;
    const title = inner?.title as string | undefined;
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-[#e8ddd0] px-4 py-2.5 text-sm text-[#78716c]">
        <span>📄</span>
        <span>{title ?? "Subpage"}</span>
      </div>
    );
  }

  // Unsupported block type — skip silently
  return null;
}

// ── Block list (handles grouping of list items) ──────────────────────────────

function BlockList({ blocks }: { blocks: NotionBlock[] }) {
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === "bulleted_list_item") {
      const items: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "bulleted_list_item") {
        items.push(blocks[i]);
        i++;
      }
      output.push(
        <ul key={`ul-${items[0].id}`} className="my-2 space-y-1">
          {items.map((b) => (
            <Block key={b.id} block={b} />
          ))}
        </ul>
      );
      continue;
    }

    if (block.type === "numbered_list_item") {
      const items: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "numbered_list_item") {
        items.push(blocks[i]);
        i++;
      }
      output.push(
        <ol key={`ol-${items[0].id}`} className="my-2 space-y-1">
          {items.map((b) => (
            <Block key={b.id} block={b} />
          ))}
        </ol>
      );
      continue;
    }

    output.push(<Block key={block.id} block={block} />);
    i++;
  }

  return <>{output}</>;
}

// ── Public component ──────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotionPageView({
  meta,
  blocks,
}: {
  meta: NotionPageMeta;
  blocks: NotionBlock[];
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[#e8ddd0] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e8ddd0] bg-[#f5f0e8] px-4 py-3">
        <div className="flex items-center gap-2">
          {meta.icon && <span className="text-lg">{meta.icon}</span>}
          <span className="font-semibold text-[#2a1f14]">{meta.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#a8a29e]">
            Last edited {formatRelativeTime(meta.last_edited_time)}
          </span>
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#b5522a] hover:underline"
            aria-label="Open in Notion"
          >
            ↗ Notion
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-4 text-sm">
        {blocks.length === 0 ? (
          <p className="text-[#a8a29e]">This page has no content.</p>
        ) : (
          <BlockList blocks={blocks} />
        )}
      </div>
    </div>
  );
}
