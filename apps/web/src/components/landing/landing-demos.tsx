"use client";

import { useState } from "react";
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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[16px] border border-line bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-muted">Your customers · tap to change consent</p>
        <ul className="mt-4 divide-y divide-line">
          {PEOPLE.map((person, i) => (
            <li key={person.name} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${optedIn[i] ? "bg-accent text-accent-ink" : "bg-sunken text-muted"}`}
                >
                  {person.name[0]}
                  {person.last[0]}
                </span>
                <span className="text-base text-ink">
                  {person.name} {person.last}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={optedIn[i]}
                aria-label={`${person.name} ${person.last} agreed to emails`}
                onClick={() => setOptedIn((current) => current.map((value, j) => (j === i ? !value : value)))}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${optedIn[i] ? "bg-success" : "bg-line-strong"}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${optedIn[i] ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col rounded-[16px] border border-line bg-surface p-6 shadow-card" aria-live="polite">
        <p className="text-sm font-medium text-muted">Review and send</p>
        <p className="mt-3 text-ink">
          <span key={recipients.length} className="inline-block text-6xl font-semibold tracking-tight text-accent tabular-nums [animation:rise_300ms_ease-out]">
            {recipients.length}
          </span>{" "}
          <span className="text-lg">{recipients.length === 1 ? "customer will" : "customers will"} receive it</span>
        </p>
        <p className="mt-1 text-muted">
          {PEOPLE.length - recipients.length} skipped: haven’t agreed to receive emails
        </p>
        <div className="mt-6 flex-1 rounded-container border border-line bg-canvas p-5">
          <p className="text-xs text-muted">Subject</p>
          <p className="font-semibold text-ink">Autumn menu is here</p>
          <p className="mt-3 text-ink">Hi {recipients[0]?.name ?? "there"},</p>
          <p className="mt-1 text-muted">Pumpkin loaves and cardamom buns are back from Saturday. See you soon!</p>
          <p className="mt-4 text-xs text-muted underline">Unsubscribe</p>
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
    <div className="rounded-[16px] bg-gradient-to-br from-[#c2410c] to-[#9a3412] p-6 text-white shadow-float">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Corner Bakery rewards</p>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">Preview</span>
      </div>
      <p className="mt-6 text-5xl font-semibold tabular-nums" aria-live="polite">
        {Math.min(points, GOAL)} <span className="text-lg font-medium">/ {GOAL} points</span>
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${Math.min(points, GOAL)}%` }} />
      </div>
      <p className="mt-3 min-h-6 text-sm text-white/90">
        {unlocked ? "Free coffee unlocked. Enjoy!" : `${GOAL - points} points to a free coffee`}
      </p>
      <button
        type="button"
        onClick={() => setPoints(unlocked ? 0 : points + PER_VISIT)}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-control bg-white px-4 font-medium text-[#c2410c] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <Icon name={unlocked ? "check" : "plus"} />
        {unlocked ? "Start a new card" : `Record a visit (+${PER_VISIT})`}
      </button>
    </div>
  );
}
