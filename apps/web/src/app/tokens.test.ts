import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

function parseTokens(block: string | undefined): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of (block ?? "").matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

const light = parseTokens(css.match(/:root\s*\{([^}]*)\}/)?.[1]);
const dark = parseTokens(
  css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1],
);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

// [foreground token, background token] pairs used by the UI for text.
const textPairs: Array<[string, string]> = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["muted", "canvas"],
  ["muted", "surface"],
  ["muted", "sunken"],
  ["accent-ink", "accent"],
  ["accent", "surface"],
  ["accent", "canvas"],
  ["accent", "accent-soft"],
  ["success", "success-soft"],
  ["success", "surface"],
  ["warning", "warning-soft"],
  ["warning", "surface"],
  ["danger", "danger-soft"],
  ["danger", "surface"],
];

describe("design tokens", () => {
  it("defines the same tokens for light and dark", () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [name, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const [foreground, background] of textPairs) {
      it(`${name}: ${foreground} on ${background} meets WCAG AA (4.5:1)`, () => {
        expect(
          contrast(tokens[foreground], tokens[background]),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("no longer overrides the Geist font with Arial", () => {
    expect(css).not.toMatch(/Arial/i);
  });
});
