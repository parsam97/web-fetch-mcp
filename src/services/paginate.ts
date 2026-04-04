export const DEFAULT_MAX_LENGTH = 5_000;

export interface PaginateResult {
  text: string;
  hasMore: boolean;
}

export function paginateContent(
  content: string,
  startIndex: number,
  maxLength: number = DEFAULT_MAX_LENGTH
): PaginateResult {
  const slice = content.slice(startIndex, startIndex + maxLength);
  const endIndex = startIndex + slice.length;
  const hasMore = endIndex < content.length;

  const parts: string[] = [];

  if (startIndex > 0) {
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
