import { Button } from "./button";
import { Icon } from "./icons";

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="text-[13px] text-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevronLeft" />
          Previous
        </Button>
        <Button size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
          <Icon name="chevronRight" />
        </Button>
      </div>
    </nav>
  );
}
