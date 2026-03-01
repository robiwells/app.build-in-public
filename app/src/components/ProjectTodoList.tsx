"use client";

import { useState, useRef } from "react";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  position: number;
};

type Props = {
  projectId: string;
  initialTodos: Todo[];
  isOwner: boolean;
};

export function ProjectTodoList({ projectId, initialTodos, isOwner }: Props) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOwner && todos.length === 0) return null;

  async function handleToggle(todo: Todo) {
    const optimistic = todos.map((t) =>
      t.id === todo.id ? { ...t, completed: !t.completed } : t
    );
    setTodos(optimistic);

    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });

    if (!res.ok) {
      setTodos(todos);
    }
  }

  async function handleDelete(todoId: string) {
    const optimistic = todos.filter((t) => t.id !== todoId);
    setTodos(optimistic);

    const res = await fetch(`/api/todos/${todoId}`, { method: "DELETE" });

    if (!res.ok) {
      setTodos(todos);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const { todo } = await res.json();
        setTodos((prev) => [...prev, todo]);
        setInput("");
        inputRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl bg-white border border-[#e8ddd0] p-4">
      <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#2a1f14] mb-3">
        To-do
      </h2>

      {todos.length === 0 && isOwner && (
        <p className="text-sm text-[#a8a29e] mb-3">No items yet — add one below.</p>
      )}

      {todos.length > 0 && (
        <ul className="space-y-2 mb-3">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-2 group">
              {isOwner ? (
                <button
                  onClick={() => handleToggle(todo)}
                  className={`h-4 w-4 shrink-0 rounded border transition-colors ${
                    todo.completed
                      ? "border-amber-400 bg-amber-400"
                      : "border-[#d6cfc6] bg-white hover:border-amber-400"
                  }`}
                  aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {todo.completed && (
                    <svg viewBox="0 0 12 12" className="h-full w-full text-white" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ) : (
                <span
                  className={`h-4 w-4 shrink-0 rounded border ${
                    todo.completed ? "border-amber-400 bg-amber-400" : "border-[#d6cfc6] bg-white"
                  } flex items-center justify-center`}
                >
                  {todo.completed && (
                    <svg viewBox="0 0 12 12" className="h-full w-full text-white" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              )}

              <span
                className={`text-sm flex-1 ${
                  todo.completed ? "line-through text-[#a8a29e]" : "text-[#2a1f14]"
                }`}
              >
                {todo.text}
              </span>

              {isOwner && (
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="text-[#d6cfc6] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none px-1"
                  aria-label="Delete item"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={handleAdd} className="flex gap-2 mt-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            placeholder="Add an item…"
            className="flex-1 text-sm border border-[#e8ddd0] rounded-lg px-3 py-1.5 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            className="shrink-0 rounded-lg bg-[#b5522a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#9e4524] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
