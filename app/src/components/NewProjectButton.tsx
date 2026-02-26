"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/ProjectForm";

/** Renders ProjectForm and refreshes the current page when a project is created. */
export function NewProjectButton() {
  const router = useRouter();
  return <ProjectForm onCreated={() => router.refresh()} />;
}
