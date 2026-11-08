import { Icon } from "./icons";

/** Logo tile and wordmark, shared by the landing page, sign-in pages and the app shell. */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const tile = size === "sm" ? "h-7 w-7 [&_svg]:h-4 [&_svg]:w-4" : "h-9 w-9";
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <span
        aria-hidden="true"
        className={`flex ${tile} items-center justify-center rounded-[6px] bg-pop text-pop-ink shadow-card outline-2 outline-offset-2 outline-dashed outline-pop/40`}
      >
        <Icon name="send" />
      </span>
      <span className={size === "sm" ? "text-[15px]" : "text-lg"}>
        DireConnect
      </span>
    </span>
  );
}
