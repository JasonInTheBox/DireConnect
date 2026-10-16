const PRODUCT = "DireConnect";

/** The browser title for a page: "<page> · DireConnect". */
export function pageTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed ? `${trimmed} · ${PRODUCT}` : PRODUCT;
}
