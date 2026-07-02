export const DEFAULT_MAX_LENGTH = 25_000;

export interface PaginateResult {
  text: string;
  hasMore: boolean;
}

export interface FetchMeta {
  strategy: string;
  extraction?: "readability" | "full-dom";
}

function fetchHeader(
  meta: FetchMeta,
  total: number,
  startIndex: number,
  endIndex: number,
  paginated: boolean
): string {
  const segments = [`fetch: ${meta.strategy}`];
  if (meta.extraction) {
    segments.push(
      `extraction: ${
        meta.extraction === "full-dom"
          ? "full-DOM fallback (Readability under-extracted)"
          : "readability"
      }`
    );
  }
  segments.push(`${total} chars total`);
  if (paginated) segments.push(`showing ${startIndex}–${endIndex}`);
  return `[${segments.join(" · ")}]`;
}

export function paginateContent(
  content: string,
  startIndex: number,
  maxLength: number = DEFAULT_MAX_LENGTH,
  meta?: FetchMeta
): PaginateResult {
  const slice = content.slice(startIndex, startIndex + maxLength);
  const endIndex = startIndex + slice.length;
  const hasMore = endIndex < content.length;
  const paginated = startIndex > 0 || hasMore;

  const parts: string[] = [];

  if (meta) {
    parts.push(fetchHeader(meta, content.length, startIndex, endIndex, paginated));
  } else if (startIndex > 0) {
    parts.push(
      `*Showing from character ${startIndex} of ${content.length} total.*`
    );
  }

  const pct = content.length
    ? Math.round((slice.length / content.length) * 100)
    : 100;

  if (hasMore) {
    parts.push(
      `⚠️ PARTIAL CONTENT: showing ${startIndex}–${endIndex} of ${content.length} chars (${pct}%). ` +
        `Do NOT draw conclusions about content you have not seen yet — ` +
        `call again with start_index=${endIndex} to continue.`
    );
  }

  if (meta?.extraction === "full-dom" && paginated) {
    parts.push(
      "*Note: this is the raw page DOM, so navigation and boilerplate may " +
        "precede the main article — the content you want can appear further " +
        "down. Missing content here means pagination is incomplete, not that " +
        "the page is JS-gated. Paginate to reach it.*"
    );
  }

  parts.push(slice);

  if (paginated) {
    parts.push(
      JSON.stringify({
        has_more: hasMore,
        next_start_index: hasMore ? endIndex : null,
        total_chars: content.length,
        start_index: startIndex,
        end_index: endIndex,
        pct_shown: pct,
      })
    );
  }

  return { text: parts.join("\n"), hasMore };
}
