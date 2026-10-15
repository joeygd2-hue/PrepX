import { Fragment, type ReactNode } from "react";
import { splitTermTokens } from "@/lib/course";

/** Renders a key term marked by `markTerms` (term index into the caller's glossary, matched text). */
export type RenderTerm = (term: number, text: string) => ReactNode;

function terms(text: string, renderTerm: RenderTerm | undefined) {
  const pieces = splitTermTokens(text);
  if (pieces.length === 1 && typeof pieces[0] === "string") return pieces[0];
  return pieces.map((p, i) => <Fragment key={i}>{typeof p === "string" ? p : renderTerm ? renderTerm(p.term, p.text) : p.text}</Fragment>);
}

/** Minimal, safe markdown: paragraphs, **bold**, *italic*, "- " and "1. " lists. No raw HTML. */
function inline(text: string, renderTerm?: RenderTerm) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{terms(p.slice(2, -2), renderTerm)}</strong>
    ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <em key={i}>{terms(p.slice(1, -1), renderTerm)}</em>
    ) : (
      <Fragment key={i}>{terms(p, renderTerm)}</Fragment>
    ),
  );
}

/** `renderTerm` turns key-term tokens (from `markTerms` in lib/course) into interactive marks. */
export function Markdown({ source, renderTerm }: { source: string; renderTerm?: RenderTerm }) {
  const blocks = source.split(/\n{2,}/);
  const md = (t: string) => inline(t, renderTerm);
  return (
    <div className="prose-lesson">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*- /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{md(l.replace(/^\s*- /, ""))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{md(l.replace(/^\s*\d+\. /, ""))}</li>)}</ol>;
        // A paragraph followed by list lines.
        const firstList = lines.findIndex((l) => /^\s*(- |\d+\. )/.test(l));
        if (firstList > 0) {
          const head = lines.slice(0, firstList).join(" ");
          const rest = lines.slice(firstList);
          const ordered = /^\s*\d+\. /.test(rest[0]);
          const items = rest.map((l, j) => <li key={j}>{md(l.replace(/^\s*(- |\d+\. )/, ""))}</li>);
          return (
            <Fragment key={i}>
              <p>{md(head)}</p>
              {ordered ? <ol>{items}</ol> : <ul>{items}</ul>}
            </Fragment>
          );
        }
        return <p key={i}>{md(lines.join(" "))}</p>;
      })}
    </div>
  );
}
