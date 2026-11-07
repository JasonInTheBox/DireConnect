"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

const PEOPLE = [
  { name: "Ada", last: "Lovelace", optedIn: true },
  { name: "Grace", last: "Hopper", optedIn: true },
  { name: "Alan", last: "Turing", optedIn: false },
  { name: "Katherine", last: "Johnson", optedIn: true },
  { name: "Hedy", last: "Lamarr", optedIn: false },
];

/** Mirrors the real rule: only customers who agreed to email receive a campaign. */
export function AudienceDemo() {
  const [optedIn, setOptedIn] = useState(PEOPLE.map((person) => person.optedIn));
  const recipients = PEOPLE.filter((_, i) => optedIn[i]);

  return (
    <div className="rounded-container border border-line bg-surface shadow-float">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <p className="font-semibold text-ink">Autumn menu is here</p>
          <p className="text-sm text-muted">Corner Bakery, review and send</p>
        </div>
        <p className="text-right" aria-live="polite">
          <span key={recipients.length} className="block text-4xl font-semibold leading-none text-accent tabular-nums [animation:rise_300ms_ease-out]">
            {recipients.length}
          </span>
          <span className="text-sm text-muted">{recipients.length === 1 ? "recipient" : "recipients"}</span>
        </p>
      </div>

      <ul className="divide-y divide-line px-6">
        {PEOPLE.map((person, i) => (
          <li key={person.name} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${optedIn[i] ? "bg-accent-soft text-accent" : "bg-sunken text-muted"}`}
              >
                {person.name[0]}
                {person.last[0]}
              </span>
              <span className={`truncate transition-colors duration-200 ${optedIn[i] ? "text-ink" : "text-muted line-through decoration-line-strong"}`}>
                {person.name} {person.last}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={optedIn[i]}
              aria-label={`${person.name} ${person.last} agreed to emails`}
              onClick={() => setOptedIn((current) => current.map((value, j) => (j === i ? !value : value)))}
              className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${optedIn[i] ? "bg-accent" : "bg-line-strong"}`}
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow-card transition-transform duration-200 ease-out ${optedIn[i] ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="m-4 mt-2 rounded-control bg-canvas p-4">
        <p className="text-ink">Hi {recipients[0]?.name ?? "there"},</p>
        <p className="mt-1 text-sm text-muted">Pumpkin loaves and cardamom buns are back from Saturday. See you soon!</p>
        <p className="mt-3 text-xs text-muted underline underline-offset-2">Unsubscribe</p>
      </div>
    </div>
  );
}

type Step = { title: string; text: string; scene: ReactNode };

/** "How it works" as four tabs, each showing its screen. */
export function StepsShowcase({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div role="tablist" aria-label="How it works" aria-orientation="vertical" className="grid gap-2">
        {steps.map((step, i) => {
          const selected = i === active;
          return (
            <button
              key={step.title}
              type="button"
              role="tab"
              id={`step-tab-${i}`}
              aria-selected={selected}
              aria-controls="step-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(event) => {
                const move = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
                if (move) {
                  event.preventDefault();
                  const next = (active + move + steps.length) % steps.length;
                  setActive(next);
                  document.getElementById(`step-tab-${next}`)?.focus();
                }
              }}
              className={`flex cursor-pointer gap-4 rounded-container px-5 py-4 text-left transition-[background-color,box-shadow] duration-200 ${selected ? "bg-surface shadow-card" : "hover:bg-surface/60"}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${selected ? "bg-accent text-accent-ink" : "bg-sunken text-muted"}`}
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{step.title}</span>
                <span className={`block text-muted ${selected ? "" : "hidden lg:block"}`}>{step.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="step-panel"
        aria-labelledby={`step-tab-${active}`}
        className="min-h-[22rem] rounded-container border border-line bg-surface p-6 shadow-float sm:p-8"
      >
        <div key={active} className="[animation:rise_300ms_ease-out]">
          {steps[active].scene}
        </div>
      </div>
    </div>
  );
}

const GOAL = 100;
const PER_VISIT = 20;

/** A preview of the planned loyalty card; nothing here is saved. */
export function LoyaltyDemo() {
  const [points, setPoints] = useState(40);
  const unlocked = points >= GOAL;

  return (
    <div className="rounded-[16px] bg-gradient-to-br from-reward to-reward-deep p-6 text-white shadow-float">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Corner Bakery rewards</p>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">Preview</span>
      </div>
      <p className="mt-6 text-5xl font-semibold tabular-nums" aria-live="polite">
        {Math.min(points, GOAL)} <span className="text-lg font-medium">/ {GOAL} points</span>
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full origin-left rounded-full bg-white transition-transform duration-500"
          style={{ transform: `scaleX(${Math.min(points, GOAL) / GOAL})` }}
        />
      </div>
      <p className="mt-3 min-h-6 text-sm text-white/90">
        {unlocked ? "Free coffee unlocked. Enjoy!" : `${GOAL - points} points to a free coffee`}
      </p>
      <button
        type="button"
        onClick={() => setPoints(unlocked ? 0 : points + PER_VISIT)}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-control bg-white px-4 font-medium text-reward transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <Icon name={unlocked ? "check" : "plus"} />
        {unlocked ? "Start a new card" : `Record a visit (+${PER_VISIT})`}
      </button>
    </div>
  );
}
