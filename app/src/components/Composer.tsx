"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";

type Project = { id: string; title: string };

type ComposerProps = {
  userId: string;
  projects: Project[];
  timezone: string;
  onPosted?: () => void;
};

export function Composer({ userId, projects, timezone, onPosted }: ComposerProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [postType, setPostType] = useState<"manual" | "milestone">("manual");
  const [projectId, setProjectId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadImage(file: File): Promise<string> {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1200,
      initialQuality: 0.75,
      fileType: "image/webp",
      useWebWorker: true,
    });

    const formData = new FormData();
    formData.set("file", compressed, "image.webp");

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Upload failed");
    }

    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      let contentImageUrl: string | undefined;

      if (imageFile) {
        setUploading(true);
        try {
          contentImageUrl = await uploadImage(imageFile);
        } finally {
          setUploading(false);
        }
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_text: text.trim(),
          project_id: projectId || undefined,
          content_image_url: contentImageUrl,
          type: postType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to post");
        return;
      }

      setText("");
      setProjectId("");
      clearImage();
      onPosted?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = submitting || uploading;

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="mb-3 flex gap-1">
        <button
          type="button"
          onClick={() => setPostType("manual")}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            postType === "manual"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400"
          }`}
          disabled={isLoading}
        >
          Post
        </button>
        <button
          type="button"
          onClick={() => setPostType("milestone")}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            postType === "milestone"
              ? "bg-amber-500 text-white"
              : "border border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400"
          }`}
          disabled={isLoading}
        >
          Milestone 🚀
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          postType === "milestone"
            ? "What did you ship? e.g. Launched v1.0 to production"
            : "What did you do for 5 minutes today?"
        }
        rows={3}
        className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        disabled={isLoading}
      />

      {imagePreview && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="" className="max-h-48 rounded-lg" />
          <button
            type="button"
            onClick={clearImage}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/70 text-xs text-white hover:bg-zinc-900"
          >
            ×
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            disabled={isLoading}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}

        <label className="cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/webp,image/png"
            className="hidden"
            onChange={handleImageSelect}
            disabled={isLoading}
          />
          {imageFile ? "Change image" : "Add image"}
        </label>

        <button
          type="submit"
          disabled={isLoading || !text.trim()}
          className="ml-auto rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {uploading ? "Uploading…" : submitting ? "Posting…" : postType === "milestone" ? "Share milestone" : "Post"}
        </button>
      </div>

      {timezone === "UTC" && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Your timezone is set to UTC. Update it in{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          for accurate streak tracking.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
