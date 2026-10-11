/** First letter or digit of a name, upper-cased, for the business tile. */
export function monogramFor(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "?";
}
