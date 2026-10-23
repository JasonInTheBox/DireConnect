export const BUSINESS_SECTIONS = ["dashboard", "customers", "campaigns"] as const;

function segmentsOf(pathname: string): string[] {
  return pathname.split("?")[0].split("/").filter(Boolean);
}

/** `/businesses/<id>/...` gives `<id>`; anything else gives null. */
export function getBusinessIdFromPath(pathname: string): string | null {
  const [root, id] = segmentsOf(pathname);
  return root === "businesses" && id ? id : null;
}

/**
 * Where to go when the user picks another business: stay in the same section
 * (dashboard, customers, campaigns); anywhere else, open the new business's dashboard.
 * Campaign IDs belong to one business, so campaign sub-pages map to the campaign list.
 */
export function pathForBusinessSwitch(pathname: string, nextBusinessId: string): string {
  const [root, , section] = segmentsOf(pathname);
  if (root === "businesses" && (BUSINESS_SECTIONS as readonly string[]).includes(section ?? "")) {
    return `/businesses/${nextBusinessId}/${section}`;
  }
  return `/businesses/${nextBusinessId}/dashboard`;
}

export function isNavActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) {
    return true;
  }
  return !exact && pathname.startsWith(`${href}/`);
}
