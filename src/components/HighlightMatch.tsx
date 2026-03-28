/** query 2+ karakter iken metinde eşleşen parçaları vurgular */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || q.length < 2) return <>{text}</>;

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let start = 0;
  let key = 0;
  while (start < text.length) {
    const found = lower.indexOf(qLower, start);
    if (found === -1) {
      nodes.push(text.slice(start));
      break;
    }
    if (found > start) nodes.push(text.slice(start, found));
    nodes.push(
      <mark
        key={`h-${key++}`}
        className="rounded bg-amber-200/90 px-0.5 font-semibold dark:bg-amber-500/35"
      >
        {text.slice(found, found + q.length)}
      </mark>,
    );
    start = found + q.length;
  }
  return <>{nodes}</>;
}
