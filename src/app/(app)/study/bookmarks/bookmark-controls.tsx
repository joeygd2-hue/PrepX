"use client";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2, NotebookPen, Trash2 } from "lucide-react";
import { removeBookmark, saveBookmarkNote, toggleBookmark, type BookmarkResult } from "@/app/actions/bookmarks";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const NOTE_MAX = 1000;
export type BookmarkValue = { bookmarked: boolean; note: string };

/**
 * Bookmark toggle + private note for one question. `saved` is the Bookmarks page variant: the
 * note is always shown and the toggle becomes a Remove button that refreshes the list.
 * Wrapped in [data-bookmark] so the exam runner's keyboard shortcuts ignore typing here.
 */
export function BookmarkControls({ questionId, initial, onChange, saved, className }: { questionId: string; initial: BookmarkValue; onChange?: (v: BookmarkValue) => void; saved?: boolean; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pressed, setPressed] = useOptimistic(value.bookmarked);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The note of a bookmark just removed with the toggle: tapping the bookmark again restores it.
  const [removedNote, setRemovedNote] = useState("");
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  // Note text typed but not saved yet. Moving on (Next, See results, leaving the page) with the
  // editor open saves it rather than silently dropping what the student wrote.
  const unsaved = useRef<string | null>(null);
  const noteId = `note-${questionId}`;

  useEffect(() => {
    return () => {
      if (unsaved.current !== null) void saveBookmarkNote(questionId, unsaved.current);
    };
  }, [questionId]);

  // Closing the note editor puts focus back on the note button so keyboard users keep their place.
  useEffect(() => {
    if (draft !== null || !refocus.current) return;
    refocus.current = false;
    root.current?.querySelector<HTMLElement>("[data-note-button]")?.focus();
  }, [draft]);

  const apply = (r: BookmarkResult) => {
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setError(null);
    const next = { bookmarked: r.bookmarked, note: r.note };
    setValue(next);
    onChange?.(next);
    return true;
  };
  const closeEditor = () => {
    refocus.current = true;
    setDraft(null);
  };
  const cancel = () => {
    unsaved.current = null;
    closeEditor();
    setError(null);
  };
  const toggle = () =>
    start(async () => {
      const on = !value.bookmarked;
      const prior = value.note;
      // Un-bookmarking means "don't keep this": an open editor's text no longer saves on its own.
      if (!on) unsaved.current = null;
      setPressed(on);
      // Send the wanted state (not a blind flip) so a stale screen can't delete a saved note.
      const ok = apply(on && removedNote ? await saveBookmarkNote(questionId, removedNote) : await toggleBookmark(questionId, on));
      if (ok) setRemovedNote(on ? "" : prior);
    });
  const save = () =>
    start(async () => {
      if (!apply(await saveBookmarkNote(questionId, draft ?? ""))) return;
      unsaved.current = null;
      setRemovedNote("");
      closeEditor();
    });
  const remove = () =>
    start(async () => {
      unsaved.current = null;
      if (!apply(await removeBookmark(questionId))) return;
      // This card is about to leave the list: keep keyboard focus nearby instead of losing it to the page.
      const li = root.current?.closest("li");
      (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector<HTMLElement>("[data-note-button]")?.focus();
      router.refresh();
    });

  return (
    <div ref={root} data-bookmark className={cn("mt-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? null : (
          <button
            type="button"
            aria-pressed={pressed}
            aria-label="Bookmark question"
            title={pressed ? "Remove bookmark" : "Bookmark question"}
            disabled={pending}
            onClick={toggle}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border transition-colors disabled:opacity-60",
              pressed ? "border-primary bg-primary text-primary-fg" : "border-border bg-card text-muted shadow-card hover:border-border-strong hover:text-fg",
            )}
          >
            <Bookmark className={cn("size-[18px]", pressed && "fill-current")} aria-hidden />
          </button>
        )}
        {draft === null ? (
          <Button data-note-button variant="ghost" size="sm" className="h-11 text-muted hover:text-fg" onClick={() => setDraft(value.note || removedNote)} disabled={pending}>
            <NotebookPen className="size-4" aria-hidden /> {value.note ? "Edit note" : "Add a note"}
          </Button>
        ) : null}
        {saved ? (
          <Button variant="ghost" size="sm" className="ml-auto h-11 text-muted hover:text-danger" onClick={remove} disabled={pending}>
            {pending && draft === null ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Remove
          </Button>
        ) : (
          <span className="text-sm text-muted" aria-live="polite">
            {pressed ? "Saved to Bookmarks" : removedNote ? "Removed. Tap the bookmark again to restore your note." : ""}
          </span>
        )}
      </div>

      {draft !== null ? (
        <div className="mt-3">
          <Label htmlFor={noteId}>
            Private note <span className="font-normal text-muted">(only you can see it)</span>
          </Label>
          <Textarea
            id={noteId}
            rows={3}
            maxLength={NOTE_MAX}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              unsaved.current = e.target.value.trim() !== value.note ? e.target.value : null;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            aria-describedby={`${noteId}-count`}
            placeholder="Why the answer is right, a memory trick, what tripped you up…"
            autoFocus
          />
          <div className="mt-2 flex items-center gap-2">
            <span id={`${noteId}-count`} className="mr-auto font-mono text-xs text-muted tabular">
              {draft.length.toLocaleString("en-US")}/{NOTE_MAX.toLocaleString("en-US")}
              <span className="sr-only"> characters</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-11"
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button size="sm" className="h-11" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save note
            </Button>
          </div>
        </div>
      ) : value.note ? (
        <div id={noteId} className="mt-3 rounded-[12px] bg-subtle px-3 py-2.5 text-sm leading-relaxed">
          <p className="eyebrow mb-1">Your note</p>
          <p className="whitespace-pre-wrap break-words">{value.note}</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
