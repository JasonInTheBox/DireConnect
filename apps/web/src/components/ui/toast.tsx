"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type Tone = "success" | "error";
type ToastItem = { id: number; tone: Tone; message: string };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const DURATION_MS: Record<Tone, number> = { success: 5_000, error: 8_000 };
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      setItems((previous) => [...previous.slice(-(MAX_VISIBLE - 1)), { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS[tone]),
      );
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => clearTimeout(timer));
  }, []);

  function renderRegion(tone: Tone) {
    return items
      .filter((item) => item.tone === tone)
      .map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-container border bg-surface p-3 text-sm shadow-float",
            tone === "error" ? "border-danger" : "border-line",
          )}
        >
          <span className={tone === "error" ? "text-danger" : "text-success"}>
            <Icon name={tone === "error" ? "alert" : "check"} className="mt-0.5" />
          </span>
          <p className="min-w-0 flex-1 text-ink">{item.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(item.id)}
            className="-m-1 rounded-control p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Icon name="x" />
          </button>
        </div>
      ));
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {renderRegion("success")}
        </div>
        <div role="alert" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {renderRegion("error")}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
