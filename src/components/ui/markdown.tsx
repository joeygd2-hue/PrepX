import { Fragment } from "react";

/** Minimal, safe markdown: paragraphs, **bold**, *italic*, "- " and "1. " lists. No raw HTML. */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <div className="prose-lesson">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*- /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*- /, ""))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+\. /, ""))}</li>)}</ol>;
        // A paragraph followed by list lines.
        const firstList = lines.findIndex((l) => /^\s*(- |\d+\. )/.test(l));
        if (firstList > 0) {
          const head = lines.slice(0, firstList).join(" ");
          const rest = lines.slice(firstList);
          const ordered = /^\s*\d+\. /.test(rest[0]);
          const items = rest.map((l, j) => <li key={j}>{inline(l.replace(/^\s*(- |\d+\. )/, ""))}</li>);
          return (
            <Fragment key={i}>
              <p>{inline(head)}</p>
              {ordered ? <ol>{items}</ol> : <ul>{items}</ul>}
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
