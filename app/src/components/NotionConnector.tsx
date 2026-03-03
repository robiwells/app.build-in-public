"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export type NotionConnectorItem = {
  id: string;
  external_id: string;
  display_name: string | null;
};

export function NotionConnector({
  initialConnectors,
}: {
  initialConnectors: NotionConnectorItem[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [connectors, setConnectors] = useState<NotionConnectorItem[]>(initialConnectors);
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const connected = connectors.length > 0;

  // Pick up ?notion=connected / ?notion=error from OAuth callback redirect
  useEffect(() => {
    const result = searchParams.get("notion");
    if (result === "connected") {
      setSuccessMsg("Notion workspace connected.");
      // Remove param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("notion");
      router.replace(url.pathname + url.search);
      // Refresh connectors list
      fetch("/api/connectors")
        .then((r) => (r.ok ? r.json() : { connectors: [] }))
        .then((data: { connectors?: Array<{ id: string; type: string; external_id: string; display_name: string | null }> }) => {
          const notion = (data.connectors ?? []).filter((c) => c.type === "notion");
          setConnectors(notion);
        })
        .catch(() => null);
    } else if (result === "denied") {
      setError("Authorisation was denied.");
      const url = new URL(window.location.href);
      url.searchParams.delete("notion");
      router.replace(url.pathname + url.search);
    } else if (result === "error" || result === "invalid") {
      setError("Something went wrong during Notion authorisation. Try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("notion");
      router.replace(url.pathname + url.search);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/connectors/notion");
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to start Notion authorisation");
        return;
      }
      // Full redirect — Notion OAuth happens in same tab, returns to /connectors
      window.location.href = data.url;
    } catch {
      setError("Request failed");
      setConnecting(false);
    }
  }

  async function handleRemove(connectorId: string) {
    if (removingId) return;
    setRemovingId(connectorId);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/connectors/notion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectorId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to remove connector");
        return;
      }
      setConnectors((prev) => prev.filter((c) => c.id !== connectorId));
    } catch {
      setError("Request failed");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f0e8]">
            {/* Notion "N" mark */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#2a1f14]">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
            </svg>
          </div>
          <span className="font-medium text-[#2a1f14]">Notion</span>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#a8a29e]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9b99a]" />
            Not connected
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-[#78716c]">
        Embed Notion pages directly on your project pages.
      </p>

      {connectors.length > 0 && (
        <ul className="mt-3 space-y-2">
          {connectors.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-[#faf8f5] px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm font-medium text-[#2a1f14]">
                {c.display_name || c.external_id}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                disabled={removingId !== null}
                aria-label={`Disconnect ${c.display_name || c.external_id}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14] disabled:opacity-50"
              >
                {removingId === c.id ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {successMsg && <p className="mt-2 text-xs text-emerald-700">{successMsg}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="rounded-full bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
        >
          {connecting ? "Redirecting…" : connected ? "Connect another workspace" : "Connect Notion"}
        </button>
      </div>
    </div>
  );
}
