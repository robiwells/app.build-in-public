"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import confetti from "canvas-confetti";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type ChecklistItem = {
  id: string;
  card_id: string;
  text: string;
  completed: boolean;
  position: number;
};

export type KanbanCard = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  checklist: ChecklistItem[];
};

export type KanbanColumn = {
  id: string;
  name: string;
  position: number;
  cards: KanbanCard[];
};

type Props = {
  projectId: string;
  initialColumns: KanbanColumn[];
  isOwner: boolean;
};

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

// ---------- Card component ----------

function KanbanCardItem({
  card,
  isOwner,
  onDelete,
  onEdit,
  isCelebrating,
  onCelebrationEnd,
}: {
  card: KanbanCard;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onEdit: (card: KanbanCard) => void;
  isCelebrating: boolean;
  onCelebrationEnd: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCelebrating || !cardRef.current) return;
    cardRef.current.classList.add("animate-kanban-done");
    const rect = cardRef.current.getBoundingClientRect();
    confetti({
      particleCount: 60,
      spread: 55,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ["#f59e0b", "#10b981", "#3b82f6"],
      scalar: 0.8,
    });
    const t = setTimeout(() => {
      cardRef.current?.classList.remove("animate-kanban-done");
      onCelebrationEnd();
    }, 2000);
    return () => clearTimeout(t);
  }, [isCelebrating, onCelebrationEnd]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={(el) => { setNodeRef(el); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
      style={style}
      className={`group relative rounded-lg bg-white border border-[#e8ddd0] p-3 shadow-sm ${isOwner ? "cursor-grab active:cursor-grabbing" : ""}`}
      {...(isOwner ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => isOwner && onEdit(card)}
            className={`w-full text-left text-sm font-medium text-[#2a1f14] break-words ${isOwner ? "cursor-pointer hover:text-[#b5522a]" : ""}`}
            disabled={!isOwner}
          >
            {card.title}
          </button>
          {card.description && (
            <p className="mt-1 text-xs text-[#78716c] line-clamp-2">{card.description}</p>
          )}
          {card.checklist.length > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#78716c]">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
                <rect x="0.5" y="0.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1"/>
                <path d="M2.5 5.5L4.5 7.5L8.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {card.checklist.filter(i => i.completed).length}/{card.checklist.length}
            </span>
          )}
        </div>
        {isOwner && (
          <button
            onClick={() => onDelete(card.id)}
            className="shrink-0 cursor-pointer text-[#d6cfc6] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none"
            aria-label="Delete card"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Ghost card for DragOverlay ----------

function CardGhost({ card }: { card: KanbanCard }) {
  return (
    <div className="rounded-lg bg-white border border-[#e8ddd0] p-3 shadow-md opacity-90 w-64">
      <p className="text-sm font-medium text-[#2a1f14] break-words">{card.title}</p>
      {card.description && (
        <p className="mt-1 text-xs text-[#78716c] line-clamp-2">{card.description}</p>
      )}
    </div>
  );
}

// ---------- Edit card form ----------

function EditCardForm({
  card,
  onSave,
  onChecklistChange,
  onClose,
}: {
  card: KanbanCard;
  onSave: (title: string, description: string) => Promise<void>;
  onChecklistChange: (cardId: string, items: ChecklistItem[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [newItemText, setNewItemText] = useState("");

  async function handleAutoSave(currentTitle: string, currentDescription: string) {
    if (!currentTitle.trim()) return;
    if (currentTitle.trim() === card.title && currentDescription.trim() === (card.description ?? "")) return;
    await onSave(currentTitle.trim(), currentDescription.trim());
  }

  async function handleToggleItem(item: ChecklistItem) {
    const updated = checklist.map((i) =>
      i.id === item.id ? { ...i, completed: !i.completed } : i
    );
    setChecklist(updated);
    onChecklistChange(card.id, updated);
    await fetch(`/api/board/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !item.completed }),
    });
  }

  async function handleSaveItemText(item: ChecklistItem) {
    const text = editingItemText.trim();
    setEditingItemId(null);
    if (!text || text === item.text) return;
    const updated = checklist.map((i) =>
      i.id === item.id ? { ...i, text } : i
    );
    setChecklist(updated);
    onChecklistChange(card.id, updated);
    await fetch(`/api/board/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  async function handleDeleteItem(itemId: string) {
    const updated = checklist.filter((i) => i.id !== itemId);
    setChecklist(updated);
    onChecklistChange(card.id, updated);
    await fetch(`/api/board/checklist/${itemId}`, { method: "DELETE" });
  }

  async function handleAddItem() {
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText("");
    const optimisticId = `opt-${Date.now()}`;
    const position = checklist.length > 0 ? Math.max(...checklist.map((i) => i.position)) + 1 : 0;
    const optimisticItem: ChecklistItem = {
      id: optimisticId,
      card_id: card.id,
      text,
      completed: false,
      position,
    };
    const nextList = [...checklist, optimisticItem];
    setChecklist(nextList);
    onChecklistChange(card.id, nextList);
    const res = await fetch(`/api/board/cards/${card.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setChecklist((prev) => {
        const next = prev.map((i) => (i.id === optimisticId ? item : i));
        setTimeout(() => onChecklistChange(card.id, next), 0);
        return next;
      });
    } else {
      setChecklist((prev) => {
        const next = prev.filter((i) => i.id !== optimisticId);
        setTimeout(() => onChecklistChange(card.id, next), 0);
        return next;
      });
      setNewItemText(text);
    }
  }

  return (
    <div className="rounded-lg bg-white border border-amber-400 p-5 shadow-sm space-y-2">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => handleAutoSave(title, description)}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (title.trim()) await handleAutoSave(title, description);
            onClose();
          }
        }}
        maxLength={200}
        rows={2}
        placeholder="Card title"
        className="w-full resize-none text-sm border border-[#e8ddd0] rounded-lg px-2 py-1.5 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400 break-words"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => handleAutoSave(title, description)}
        maxLength={2000}
        rows={3}
        placeholder="Description (optional)"
        className="w-full resize-none text-sm border border-[#e8ddd0] rounded-lg px-2 py-1.5 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400"
      />

      {/* Checklist */}
      <div>
        <p className="text-xs font-medium text-[#78716c] mb-1.5">Checklist</p>
        {checklist.length > 0 && (
          <div className="space-y-1 mb-2">
            {checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleItem(item)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border border-[#d6cfc6] accent-amber-400"
                />
                {editingItemId === item.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingItemText}
                    onChange={(e) => setEditingItemText(e.target.value)}
                    onBlur={() => handleSaveItemText(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingItemId(null);
                    }}
                    maxLength={200}
                    className="flex-1 rounded border border-amber-400 px-1.5 py-0.5 text-sm text-[#2a1f14] focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); }}
                    className={`flex-1 text-left text-sm ${item.completed ? "line-through text-[#a8a29e]" : "text-[#2a1f14]"}`}
                  >
                    {item.text}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="shrink-0 text-[#d6cfc6] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none"
                  aria-label="Delete item"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
          maxLength={200}
          placeholder="Add item…"
          className="w-full text-sm border border-[#e8ddd0] rounded-lg px-2 py-1.5 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400"
        />
      </div>

    </div>
  );
}

// ---------- Column component ----------

function KanbanColumnItem({
  column,
  isOwner,
  onDeleteColumn,
  onClearColumn,
  onRenameColumn,
  onAddCard,
  onDeleteCard,
  onEditCard,
  celebratingCardId,
  onCelebrationEnd,
}: {
  column: KanbanColumn;
  isOwner: boolean;
  onDeleteColumn: (id: string) => void;
  onClearColumn: (id: string) => void;
  onRenameColumn: (id: string, name: string) => void;
  onAddCard: (columnId: string, title: string, description: string) => Promise<void>;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (card: KanbanCard) => void;
  celebratingCardId: string | null;
  onCelebrationEnd: () => void;
}) {
  const isDone = column.name === "Done";
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(column.name);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"clear" | "deleteColumn" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const committingRef = useRef(false);
  const newCardInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!addingCard) return;
    const el = newCardInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Match card min height: p-3 (12px*2) + one line (~20px) ≈ 44px
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [addingCard, newCardTitle]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmAction) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmAction(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmAction]);

  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen((o) => !o);
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  async function handleRenameBlur() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== column.name) {
      onRenameColumn(column.id, trimmed);
    } else {
      setNameValue(column.name);
    }
  }

  async function handleCommitCard(stayOpen: boolean) {
    if (committingRef.current) return;
    committingRef.current = true;
    const trimmed = newCardTitle.trim();
    setNewCardTitle("");
    if (trimmed) await onAddCard(column.id, trimmed, "");
    if (stayOpen) {
      committingRef.current = false;
      setAddingCard(true);
      requestAnimationFrame(() => newCardInputRef.current?.focus());
    } else {
      setAddingCard(false);
      committingRef.current = false;
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-64 shrink-0 rounded-xl p-3 flex flex-col gap-2 group ${isDone ? "bg-[#eef0e8] border border-[#cdd4be]" : "bg-[#f5f0e8] border border-[#e8ddd0]"}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2">
        {isOwner && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab text-[#d6cfc6] hover:text-[#a8a29e] active:cursor-grabbing"
            aria-label="Drag column"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="3" cy="2.5" r="1.5" />
              <circle cx="7" cy="2.5" r="1.5" />
              <circle cx="3" cy="7" r="1.5" />
              <circle cx="7" cy="7" r="1.5" />
              <circle cx="3" cy="11.5" r="1.5" />
              <circle cx="7" cy="11.5" r="1.5" />
            </svg>
          </button>
        )}

        {editingName && isOwner && !isDone ? (
          <input
            autoFocus
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setNameValue(column.name); setEditingName(false); } }}
            maxLength={50}
            className="flex-1 rounded px-1 py-0.5 text-sm font-medium text-[#2a1f14] border border-amber-400 focus:outline-none bg-white"
          />
        ) : isDone ? (
          <span className="flex flex-1 items-center gap-1.5 min-w-0">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0" style={{ color: "#4d6040" }}>
              <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-medium text-sm truncate" style={{ color: "#3d4e32" }}>{column.name}</span>
          </span>
        ) : (
          <button
            onClick={() => isOwner && setEditingName(true)}
            className={`flex-1 text-left font-medium text-sm text-[#2a1f14] truncate ${isOwner ? "hover:text-[#b5522a]" : ""}`}
            disabled={!isOwner}
          >
            {column.name}
          </button>
        )}

        {isOwner && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100">
            <button
              ref={triggerRef}
              type="button"
              onClick={openMenu}
              className="rounded p-1 text-[#a8a29e] hover:bg-[#ede8df] hover:text-[#78716c] focus:outline-none focus:ring-2 focus:ring-[#b5522a]/30"
              aria-label="Column options"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-base leading-none">⋯</span>
            </button>
            <div
              ref={menuRef}
              style={menuPos ? { top: menuPos.top, right: menuPos.right } : {}}
              className={[
                "fixed z-50 w-48 origin-top-right rounded-lg border border-[#e8ddd0] bg-white py-1 shadow-lg transition-[opacity,transform] duration-100",
                menuOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setConfirmAction("clear"); }}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete all cards
              </button>
              {!isDone && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setConfirmAction("deleteColumn"); }}
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete list
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-[#f5f0e8] border border-[#e8ddd0] shadow-[0_4px_14px_rgba(42,31,20,0.08)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-[#2a1f14]">
              {confirmAction === "clear"
                ? `Delete all ${column.cards.length} card${column.cards.length !== 1 ? "s" : ""} from "${column.name}"? This cannot be undone.`
                : column.cards.length > 0
                  ? `Delete "${column.name}" and its ${column.cards.length} card${column.cards.length !== 1 ? "s" : ""}? This cannot be undone.`
                  : `Delete list "${column.name}"?`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg bg-white border border-[#e8ddd0] px-3 py-1.5 text-sm font-medium text-[#78716c] hover:bg-[#ece7df] focus:outline-none focus:ring-2 focus:ring-[#b5522a]/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === "clear") onClearColumn(column.id);
                  else onDeleteColumn(column.id);
                  setConfirmAction(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {column.cards.map((card) => (
            <KanbanCardItem
              key={card.id}
              card={card}
              isOwner={isOwner}
              onDelete={onDeleteCard}
              onEdit={(c) => onEditCard(c)}
              isCelebrating={celebratingCardId === card.id}
              onCelebrationEnd={onCelebrationEnd}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add card */}
      {isOwner && (
        addingCard ? (
          <textarea
            ref={newCardInputRef}
            autoFocus
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            onBlur={() => handleCommitCard(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newCardTitle.trim()) handleCommitCard(true);
              }
              if (e.key === "Escape") { committingRef.current = true; setAddingCard(false); setNewCardTitle(""); }
            }}
            maxLength={200}
            rows={1}
            placeholder="Card title"
            className="mt-1 w-full resize-none overflow-hidden text-sm font-medium border border-[#e8ddd0] rounded-lg p-3 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400 bg-white break-words"
          />
        ) : (
          <button
            onClick={() => { committingRef.current = false; setAddingCard(true); }}
            className="mt-1 w-full rounded-lg border border-dashed border-[#d6cfc6] px-3 py-1.5 text-xs text-[#a8a29e] hover:border-[#b5522a] hover:text-[#b5522a] transition-colors text-left"
          >
            + Add card
          </button>
        )
      )}
    </div>
  );
}

// ---------- Column ghost for DragOverlay ----------

function ColumnGhost({ column }: { column: KanbanColumn }) {
  return (
    <div className="w-64 shrink-0 rounded-xl bg-[#f5f0e8] border border-[#e8ddd0] p-3 opacity-90 shadow-lg">
      <p className="font-medium text-sm text-[#2a1f14]">{column.name}</p>
      <p className="text-xs text-[#a8a29e] mt-1">{column.cards.length} card{column.cards.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ---------- Main board ----------

export function ProjectKanban({ projectId, initialColumns, isOwner }: Props) {
  const router = useRouter();
  const [columns, setColumns] = useState<KanbanColumn[]>(
    initialColumns.map((col) => ({
      ...col,
      cards: [...col.cards].sort((a, b) => a.position - b.position),
    })).sort((a, b) => a.position - b.position)
  );
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [celebratingCardId, setCelebratingCardId] = useState<string | null>(null);
  const handleCelebrationEnd = useCallback(() => setCelebratingCardId(null), []);
  const dragSourceColIdRef = useRef<string | null>(null);
  const overColRef = useRef<string | null>(null);

  // Add column inline state
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const addingColRef = useRef(false);
  const [expandOpen, setExpandOpen] = useState(false);

  useEffect(() => {
    if (!expandOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expandOpen]);
  const newColInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingCardId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setEditingCardId(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingCardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const hasCards = columns.some((c) => c.cards.length > 0);
  if (!isOwner && !hasCards) return null;

  // ---------- Setup board ----------

  async function handleSetupBoard() {
    if (settingUp) return;
    setSettingUp(true);
    const created: KanbanColumn[] = [];
    for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
      const res = await fetch(`/api/projects/${projectId}/board/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: DEFAULT_COLUMNS[i] }),
      });
      if (res.ok) {
        const { column } = await res.json();
        created.push({ ...column, cards: [] });
      }
    }
    setColumns(created);
    setSettingUp(false);
  }

  // ---------- Column actions ----------

  async function handleCommitColumn() {
    if (addingColRef.current) return;
    addingColRef.current = true;
    const name = newColName.trim();
    setAddingColumn(false);
    setNewColName("");
    if (name) {
      const tempId = `temp-${Date.now()}`;
      setColumns((prev) => [...prev, { id: tempId, name, position: prev.length, cards: [] }]);

      const res = await fetch(`/api/projects/${projectId}/board/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const { column } = await res.json();
        setColumns((prev) => prev.map((c) => c.id === tempId ? { ...column, cards: [] } : c));
      } else {
        setColumns((prev) => prev.filter((c) => c.id !== tempId));
      }
    }
    addingColRef.current = false;
  }

  async function handleDeleteColumn(columnId: string) {
    const prev = columns;
    setColumns((cols) => cols.filter((c) => c.id !== columnId));

    const res = await fetch(`/api/board/columns/${columnId}`, { method: "DELETE" });
    if (!res.ok) setColumns(prev);
  }

  async function handleClearColumn(columnId: string) {
    const prev = columns;
    setColumns((cols) =>
      cols.map((c) => c.id === columnId ? { ...c, cards: [] } : c)
    );

    const res = await fetch(`/api/board/columns/${columnId}/cards`, { method: "DELETE" });
    if (!res.ok) setColumns(prev);
  }

  async function handleRenameColumn(columnId: string, name: string) {
    const prev = columns;
    setColumns((cols) => cols.map((c) => c.id === columnId ? { ...c, name } : c));

    const res = await fetch(`/api/board/columns/${columnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) setColumns(prev);
  }

  // ---------- Card actions ----------

  async function handleAddCard(columnId: string, title: string, description: string) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: KanbanCard = {
      id: tempId,
      column_id: columnId,
      title,
      description: description || null,
      position: columns.find((c) => c.id === columnId)?.cards.length ?? 0,
      checklist: [],
    };

    setColumns((cols) =>
      cols.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, optimistic] } : c
      )
    );

    const res = await fetch(`/api/projects/${projectId}/board/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: columnId, title, description: description || undefined }),
    });

    if (res.ok) {
      const { card } = await res.json();
      setColumns((cols) =>
        cols.map((c) =>
          c.id === columnId
            ? { ...c, cards: c.cards.map((cd) => cd.id === tempId ? { ...card, checklist: [] } : cd) }
            : c
        )
      );
    } else {
      setColumns((cols) =>
        cols.map((c) =>
          c.id === columnId ? { ...c, cards: c.cards.filter((cd) => cd.id !== tempId) } : c
        )
      );
    }
  }

  function handleChecklistChange(cardId: string, items: ChecklistItem[]) {
    setColumns((cols) => cols.map((c) => ({
      ...c,
      cards: c.cards.map((card) => card.id === cardId ? { ...card, checklist: items } : card),
    })));
  }

  async function handleDeleteCard(cardId: string) {
    const prev = columns;
    setColumns((cols) =>
      cols.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== cardId) }))
    );

    const res = await fetch(`/api/board/cards/${cardId}`, { method: "DELETE" });
    if (!res.ok) setColumns(prev);
  }

  async function handleSaveCard(card: KanbanCard, title: string, description: string) {
    const prev = columns;
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.map((cd) =>
          cd.id === card.id ? { ...cd, title, description: description || null } : cd
        ),
      }))
    );

    const res = await fetch(`/api/board/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || null }),
    });
    if (!res.ok) setColumns(prev);
  }

  // ---------- DnD ----------

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "card") {
      setActiveCard(data.card);
      dragSourceColIdRef.current = data.card.column_id;
      overColRef.current = data.card.column_id;
    }
    if (data?.type === "column") {
      const col = columns.find((c) => c.id === event.active.id);
      if (col) setActiveColumn(col);
      dragSourceColIdRef.current = null;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    if (activeData?.type !== "card") return;

    const overData = over.data.current;
    const targetColumnId = overData?.type === "card"
      ? (overData.card.column_id as string)
      : (over.id as string);

    // Only update state when crossing a column boundary — prevents rapid setState
    // calls from mouse-move events crashing React's update depth limit
    if (targetColumnId === overColRef.current) return;
    overColRef.current = targetColumnId;

    setColumns((cols) => {
      const sourceColIdx = cols.findIndex((c) => c.cards.some((cd) => cd.id === active.id));
      const targetColIdx = cols.findIndex((c) => c.id === targetColumnId);
      if (sourceColIdx === -1 || targetColIdx === -1 || sourceColIdx === targetColIdx) return cols;

      const activeCard = cols[sourceColIdx].cards.find((c) => c.id === active.id)!;
      const updatedCard = { ...activeCard, column_id: targetColumnId };
      const newSourceCards = cols[sourceColIdx].cards.filter((c) => c.id !== active.id);
      const newTargetCards = [...cols[targetColIdx].cards, updatedCard];

      return cols.map((c, i) => {
        if (i === sourceColIdx) return { ...c, cards: newSourceCards };
        if (i === targetColIdx) return { ...c, cards: newTargetCards };
        return c;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    setActiveColumn(null);
    overColRef.current = null;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;

    if (activeData?.type === "column") {
      // Reorder columns
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));
      setColumns(reordered);

      fetch(`/api/board/columns/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newIndex }),
      });
      return;
    }

    if (activeData?.type === "card") {
      const cardId = active.id as string;
      const originalColId = dragSourceColIdRef.current;
      const overData = over.data.current;

      const targetColumnId = overData?.type === "card"
        ? (overData.card.column_id as string)
        : (over.id as string);

      const targetColIdx = columns.findIndex((c) => c.id === targetColumnId);
      if (targetColIdx === -1) return;

      const isCrossColumn = originalColId !== null && originalColId !== targetColumnId;

      if (isCrossColumn) {
        // dragOver appended the card to the end of the target column.
        // Compute the correct final position from where the user actually dropped.
        const overData = over.data.current;
        const targetCards = columns[targetColIdx].cards;
        const cardCurrentIdx = targetCards.findIndex((c) => c.id === cardId);

        let finalIdx = overData?.type === "card"
          ? targetCards.findIndex((c) => c.id === over.id)
          : cardCurrentIdx;
        if (finalIdx === -1) finalIdx = cardCurrentIdx;

        if (finalIdx !== cardCurrentIdx) {
          const reordered = arrayMove(targetCards, cardCurrentIdx, finalIdx).map((c, i) => ({ ...c, position: i }));
          setColumns((cols) => cols.map((c, i) => i === targetColIdx ? { ...c, cards: reordered } : c));
        }

        fetch(`/api/board/cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column_id: targetColumnId, position: finalIdx }),
        });

        if (columns[targetColIdx].name === "Done") {
          setCelebratingCardId(cardId);
          fetch(`/api/board/cards/${cardId}/done`, { method: "POST" })
            .then(() => router.refresh());
        }
      } else {
        // Within-column sort — handleDragOver skipped this, do it now
        const colIdx = targetColIdx;
        const cards = [...columns[colIdx].cards];
        const oldIdx = cards.findIndex((c) => c.id === cardId);
        let newIdx = cards.findIndex((c) => c.id === over.id);
        if (newIdx === -1) newIdx = cards.length;
        if (oldIdx === newIdx) return;

        const moved = arrayMove(cards, oldIdx, newIdx).map((c, i) => ({ ...c, position: i }));
        setColumns((cols) => cols.map((c, i) => i === colIdx ? { ...c, cards: moved } : c));

        fetch(`/api/board/cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column_id: targetColumnId, position: newIdx }),
        });
      }
    }
  }

  // ---------- Render ----------

  function renderBoardBody(inModal = false) {
    if (isOwner && columns.length === 0) {
      return (
        <div className="rounded-xl bg-[#f5f0e8] border border-[#e8ddd0] p-6 text-center">
          <p className="text-sm text-[#78716c] mb-3">No columns yet. Set up default columns to get started.</p>
          <button
            onClick={handleSetupBoard}
            disabled={settingUp}
            className="rounded-lg bg-[#b5522a] px-4 py-2 text-sm font-medium text-white hover:bg-[#9e4524] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {settingUp ? "Setting up…" : "Set up board"}
          </button>
        </div>
      );
    }

    return (
      <DndContext id="project-kanban" sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className={inModal ? "pb-3" : "max-h-[60vh] overflow-x-auto overflow-y-auto pb-3"}>
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 items-start" style={{ minWidth: "max-content" }}>
              {columns.map((column) => (
                <KanbanColumnItem
                  key={column.id}
                  column={column}
                  isOwner={isOwner}
                  onDeleteColumn={handleDeleteColumn}
                  onClearColumn={handleClearColumn}
                  onRenameColumn={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={(card) => setEditingCardId(card.id)}
                  celebratingCardId={celebratingCardId}
                  onCelebrationEnd={handleCelebrationEnd}
                />
              ))}

              {/* Add column */}
              {isOwner && (
                addingColumn ? (
                  <div className="w-64 shrink-0 rounded-xl bg-[#f5f0e8] border border-[#e8ddd0] p-3">
                    <input
                      ref={newColInputRef}
                      autoFocus
                      type="text"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onBlur={handleCommitColumn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                        if (e.key === "Escape") { addingColRef.current = true; setAddingColumn(false); setNewColName(""); }
                      }}
                      maxLength={50}
                      placeholder="Column name"
                      className="w-full text-sm border border-[#e8ddd0] rounded-lg px-2 py-1.5 text-[#2a1f14] placeholder:text-[#a8a29e] focus:outline-none focus:border-amber-400 bg-white"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingColumn(true); setTimeout(() => newColInputRef.current?.focus(), 50); }}
                    className="w-64 shrink-0 rounded-xl border border-dashed border-[#d6cfc6] p-3 text-sm text-[#a8a29e] hover:border-[#b5522a] hover:text-[#b5522a] transition-colors text-left"
                  >
                    + Add column
                  </button>
                )
              )}
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeCard && <CardGhost card={activeCard} />}
          {activeColumn && <ColumnGhost column={activeColumn} />}
        </DragOverlay>
      </DndContext>
    );
  }

  const editingCard = editingCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === editingCardId)
    : null;

  return (
    <div className="mt-6 mb-0">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#78716c]">Board</span>
        {columns.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandOpen(true)}
            className="rounded p-1 text-[#a8a29e] hover:bg-[#f5f0e8] hover:text-[#78716c] transition-colors focus:outline-none focus:ring-2 focus:ring-[#b5522a]/30"
            aria-label="Expand board"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline board (hidden when modal is open) */}
      {expandOpen ? (
        <div className="rounded-xl bg-[#f5f0e8] border border-dashed border-[#d6cfc6] h-24 flex items-center justify-center">
          <span className="text-sm text-[#a8a29e]">Board open in expanded view</span>
        </div>
      ) : (
        renderBoardBody()
      )}

      {/* Expanded board modal */}
      {expandOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setExpandOpen(false)}
        >
          <div
            className="fixed inset-4 z-50 rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[#e8ddd0] px-4 py-3 shrink-0">
              <span className="font-semibold text-[#2a1f14]">Board</span>
              <button
                type="button"
                onClick={() => setExpandOpen(false)}
                className="rounded-lg p-1 text-[#78716c] hover:bg-[#f5f0e8] hover:text-[#2a1f14] transition-colors"
                aria-label="Close expanded board"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-auto p-4">
              {renderBoardBody(true)}
            </div>
          </div>
        </div>
      )}

      {/* Card edit modal */}
      {editingCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingCardId(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <EditCardForm
              card={editingCard}
              onSave={async (t, d) => { await handleSaveCard(editingCard, t, d); }}
              onChecklistChange={handleChecklistChange}
              onClose={() => setEditingCardId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
