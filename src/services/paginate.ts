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
    if (meta.extraction === "full-dom" && paginated) {
      parts.push(
        "*Note: this is the raw page DOM, so navigation and boilerplate may " +
          "precede the main article — the content you want can appear further " +
          "down. Paginate to reach it.*"
      );
    }
  } else if (startIndex > 0) {
    parts.push(
      `*Showing from character ${startIndex} of ${content.length} total.*`
    );
  }

  if (hasMore) {
    parts.push(
      `*Content truncated. Use start_index=${endIndex} to continue.*`
    );
  }

  parts.push(slice);

  return { text: parts.join("\n"), hasMore };
}
