"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/cn";
import { nextMenuIndex, typeAheadIndex, type MenuKey } from "@/lib/menuNav";
import { Icon } from "./icons";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  selected?: boolean;
  icon?: ReactNode;
  separatorBefore?: boolean;
};

export type MenuTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

type MenuProps = {
  items: MenuItem[];
  trigger: (props: MenuTriggerProps) => ReactNode;
  align?: "start" | "end";
};

const TYPE_AHEAD_RESET_MS = 600;

export function Menu({ items, trigger, align = "start" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typed = useRef<{ text: string; timer: ReturnType<typeof setTimeout> | undefined }>({
    text: "",
    timer: undefined,
  });
  const triggerId = useId();
  const panelId = useId();
  const selectedIndex = items.findIndex((item) => item.selected);

  const openMenu = useCallback((index: number) => {
    setActiveIndex(index);
    setOpen(true);
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeMenu(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    const buffer = typed.current;
    return () => clearTimeout(buffer.timer);
  }, []);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(items.length - 1);
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;

    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      event.preventDefault();
      setActiveIndex(nextMenuIndex(activeIndex, items.length, key as MenuKey));
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (key === "Tab") {
      // Hand focus back first so the browser's Tab moves on from the trigger.
      triggerRef.current?.focus();
      closeMenu(false);
      return;
    }

    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      clearTimeout(typed.current.timer);
      typed.current.text += key;
      typed.current.timer = setTimeout(() => {
        typed.current.text = "";
      }, TYPE_AHEAD_RESET_MS);
      const index = typeAheadIndex(
        items.map((item) => item.label),
        typed.current.text,
        activeIndex,
      );
      if (index >= 0) {
        setActiveIndex(index);
      }
    }
  }

  function selectItem(item: MenuItem) {
    closeMenu(true);
    item.onSelect();
  }

  return (
    <div ref={wrapperRef} className="relative">
      {trigger({
        ref: triggerRef,
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? panelId : undefined,
        onClick: () => (open ? closeMenu(false) : openMenu(selectedIndex >= 0 ? selectedIndex : 0)),
        onKeyDown: handleTriggerKeyDown,
      })}

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handlePanelKeyDown}
          className={cn(
            "absolute z-50 mt-1 max-h-80 min-w-64 overflow-auto rounded-container border border-line bg-surface p-1 shadow-float",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <div key={item.id}>
              {item.separatorBefore ? <div role="separator" className="my-1 h-px bg-line" /> : null}
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role={item.selected === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.selected === undefined ? undefined : item.selected}
                tabIndex={-1}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className="flex w-full items-center gap-2.5 min-h-10 rounded-control px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-sunken focus:bg-sunken lg:min-h-9"
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.selected ? <Icon name="check" className="text-accent" /> : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
