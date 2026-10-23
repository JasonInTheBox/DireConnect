/** First letter or digit of a name, upper-cased, for the business tile. */
export function monogramFor(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "?";
}

/** "1 customer", "2 customers": the count with the right noun. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
