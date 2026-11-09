import { PageSkeleton } from "@/components/ui/skeleton";

// Shown at once while a page's code and data load, so a first visit never shows a blank screen.
export default function Loading() {
  return <PageSkeleton />;
}
