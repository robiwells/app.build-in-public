"use client";

import { useEffect, useState } from "react";

type UserConnector = {
  id: string;
  type: string;
  external_id: string;
  display_name: string | null;
};

export type AvailableRepo = { full_name: string; html_url: string; installation_id: number };

export type PendingConnectorSelection = {
  repos?: AvailableRepo[];
  medium?: { external_id: string };
};

type Step = "pick-service" | "pick-github-repos" | "confirm-medium";

export function ConnectorModal({
  projectId,
  filterType,
  onAdded,
  onClose,
  /** When editing, full_names of repos already linked to the project (so they appear pre-selected). */
  existingRepoFullNames,
}: {
  /** When undefined, modal is in "create" mode: returns selection via onAdded instead of POSTing. */
  projectId?: string;
  filterType?: string;
  onAdded: (selection?: PendingConnectorSelection) => void;
  onClose: () => void;
  existingRepoFullNames?: string[];
}) {
  const isCreateMode = projectId === undefined;
  const [step, setStep] = useState<Step>("pick-service");
  const [userConnectors, setUserConnectors] = useState<UserConnector[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [selectedConnector, setSelectedConnector] = useState<UserConnector | null>(null);

  // GitHub state
  const [githubAvailable, setGithubAvailable] = useState<AvailableRepo[]>([]);
  const [githubSelected, setGithubSelected] = useState<Set<string>>(new Set());
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubSaving, setGithubSaving] = useState(false);
  const [githubError, setGithubError] = useState("");

  // Medium state
  const [mediumSaving, setMediumSaving] = useState(false);
  const [mediumError, setMediumError] = useState("");

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => (r.ok ? r.json() : { connectors: [] }))
      .then((data: { connectors?: UserConnector[] }) =>
        setUserConnectors(data.connectors ?? [])
      )
      .catch(() => setUserConnectors([]))
      .finally(() => setConnectorsLoading(false));
  }, []);

  const visibleConnectors = filterType
    ? userConnectors.filter((c) => c.type === filterType)
    : userConnectors;

  function selectConnector(connector: UserConnector) {
    setSelectedConnector(connector);
    if (connector.type === "github") {
      setStep("pick-github-repos");
      setGithubLoading(true);
      setGithubAvailable([]);
      setGithubSelected(new Set());
      setGithubError("");
      const url =
        isCreateMode || projectId === undefined
          ? "/api/repos/available"
          : `/api/repos/available?projectId=${encodeURIComponent(projectId!)}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : { repos: [] }))
        .then((data: { repos?: AvailableRepo[] }) => {
          const repos = data.repos ?? [];
          setGithubAvailable(repos);
          if (existingRepoFullNames?.length) {
            setGithubSelected(
              new Set(repos.filter((r) => existingRepoFullNames.includes(r.full_name)).map((r) => r.full_name))
            );
          } else {
            setGithubSelected(new Set());
          }
        })
        .catch(() => setGithubAvailable([]))
        .finally(() => setGithubLoading(false));
    } else if (connector.type === "medium") {
      setStep("confirm-medium");
      setMediumError("");
    }
  }

  function toggleGithubRepo(fullName: string) {
    setGithubSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function handleAddGithubRepos() {
    if (githubSelected.size === 0) return;
    const toAdd = githubAvailable.filter((r) => githubSelected.has(r.full_name));
    if (isCreateMode) {
      onAdded({ repos: toAdd });
      onClose();
      return;
    }
    // When editing, only POST repos not already on the project (pre-selected are for display)
    const newRepos =
      existingRepoFullNames?.length
        ? toAdd.filter((r) => !existingRepoFullNames.includes(r.full_name))
        : toAdd;
    if (newRepos.length === 0) {
      onAdded();
      onClose();
      return;
    }
    setGithubSaving(true);
    setGithubError("");
    try {
      for (const repo of newRepos) {
        const res = await fetch(`/api/projects/${projectId}/repos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_full_name: repo.full_name,
            repo_url: repo.html_url,
            installation_id: repo.installation_id,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setGithubError((data as { error?: string }).error ?? "Failed to add repo");
          return;
        }
      }
      onAdded();
      onClose();
    } catch {
      setGithubError("Request failed");
    } finally {
      setGithubSaving(false);
    }
  }

  async function handleAddMedium() {
    if (!selectedConnector) return;
    if (isCreateMode) {
      onAdded({ medium: { external_id: selectedConnector.external_id } });
      onClose();
      return;
    }
    setMediumSaving(true);
    setMediumError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_type: "medium",
          external_id: selectedConnector.external_id,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setMediumError(data.error ?? "Failed to add Medium feed");
        return;
      }
      onAdded();
      onClose();
    } catch {
      setMediumError("Request failed");
    } finally {
      setMediumSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8ddd0] px-4 py-3">
          <h2 className="font-semibold text-[#2a1f14]">
            {step === "pick-service" && "Add connector"}
            {step === "pick-github-repos" && "Add GitHub repo"}
            {step === "confirm-medium" && "Add Medium feed"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {step === "pick-service" && (
            <>
              {connectorsLoading ? (
                <p className="text-sm text-[#78716c]">Loading…</p>
              ) : visibleConnectors.length === 0 ? (
                <p className="text-sm text-[#78716c]">
                  No connected services found. Set up connectors via the{" "}
                  <a href="/connectors" className="text-[#b5522a] hover:underline">
                    Connectors
                  </a>{" "}
                  page.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-[#78716c]">Your connected services:</p>
                  {visibleConnectors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectConnector(c)}
                      className="flex w-full items-center gap-3 rounded-lg border border-[#e8ddd0] px-3 py-2.5 text-left text-sm hover:border-[#c9b99a] hover:bg-[#faf7f2]"
                    >
                      <ConnectorIcon type={c.type} />
                      <span className="text-[#2a1f14]">
                        {c.display_name ?? `${c.type} (${c.external_id})`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "pick-github-repos" && (
            <>
              {githubLoading ? (
                <p className="text-sm text-[#78716c]">Loading repos…</p>
              ) : githubAvailable.length === 0 ? (
                <p className="text-sm text-[#78716c]">
                  No available repos. All repos may already be linked to projects.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[#e8ddd0] p-2">
                  {githubAvailable.map((r) => (
                    <label
                      key={r.full_name}
                      className={[
                        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        githubSelected.has(r.full_name)
                          ? "bg-[#f5f0e8] text-[#2a1f14]"
                          : "text-[#78716c] hover:bg-[#faf7f2]",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={githubSelected.has(r.full_name)}
                        onChange={() => toggleGithubRepo(r.full_name)}
                        className="h-4 w-4 rounded border-[#e8ddd0] text-[#b5522a] focus:ring-[#b5522a]/30"
                      />
                      <span className="truncate">{r.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
              {githubError && (
                <p className="mt-2 text-xs text-red-600">{githubError}</p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleAddGithubRepos}
                  disabled={githubSaving || githubSelected.size === 0}
                  className="rounded-full bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
                >
                  {githubSaving ? "Adding…" : `Add selected${githubSelected.size > 0 ? ` (${githubSelected.size})` : ""}`}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("pick-service")}
                  className="rounded-full px-4 py-1.5 text-sm text-[#78716c] hover:text-[#2a1f14]"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {step === "confirm-medium" && selectedConnector && (
            <>
              <div className="rounded-lg border border-[#e8ddd0] px-4 py-3">
                <p className="text-sm font-medium text-[#2a1f14]">
                  {selectedConnector.external_id}
                </p>
                {selectedConnector.display_name && (
                  <p className="mt-0.5 text-xs text-[#78716c]">
                    {selectedConnector.display_name}
                  </p>
                )}
              </div>
              {mediumError && (
                <p className="mt-2 text-xs text-red-600">{mediumError}</p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleAddMedium}
                  disabled={mediumSaving}
                  className="rounded-full bg-[#b5522a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-50"
                >
                  {mediumSaving ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("pick-service")}
                  className="rounded-full px-4 py-1.5 text-sm text-[#78716c] hover:text-[#2a1f14]"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectorIcon({ type }: { type: string }) {
  if (type === "github") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#24292e] text-[10px] font-bold text-white">
        GH
      </span>
    );
  }
  if (type === "medium") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
        M
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8ddd0] text-[10px] font-medium text-[#78716c] uppercase">
      {type[0]}
    </span>
  );
}
