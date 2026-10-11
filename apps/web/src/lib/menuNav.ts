export type MenuKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export function nextMenuIndex(current: number, count: number, key: MenuKey): number {
  if (count === 0) {
    return -1;
  }
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}

/**
 * Index of the next label that starts with what the user has typed.
 * One typed letter cycles forward from the current item; longer text refines in place.
 */
export function typeAheadIndex(labels: string[], query: string, current: number): number {
  const text = query.trim().toLowerCase();
  if (!text || labels.length === 0) {
    return -1;
  }
  const start = current < 0 ? 0 : current + (text.length === 1 ? 1 : 0);
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = (start + offset) % labels.length;
    if (labels[index].toLowerCase().startsWith(text)) {
      return index;
    }
  }
  return -1;
}
