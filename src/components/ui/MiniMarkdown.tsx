import type { ReactNode } from "react";

/** Inline: **bold** and `code`. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 text-[12px]" dir="ltr">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

/** Tiny markdown renderer for release notes: headings, bullets, bold, code, paragraphs. */
export function MiniMarkdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul${blocks.length}`} className="my-1 list-disc space-y-0.5 ps-5">
        {items.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet) bullets.push(bullet[1]);
    else {
      flush();
      if (heading) blocks.push(<div key={blocks.length} className="mt-2 text-[13px] font-bold text-fg">{inline(heading[1])}</div>);
      else if (line) blocks.push(<p key={blocks.length} className="my-1">{inline(line)}</p>);
    }
  }
  flush();
  return <div className="text-[13px] leading-6 text-muted">{blocks}</div>;
}
