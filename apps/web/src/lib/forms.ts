/** Moves focus to the first field marked invalid, after React has rendered the errors. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

/**
 * Splits server field errors into those a form renders and the rest, so an error for a
 * field the form does not show is surfaced (as a form-level message) and never dropped.
 */
export function splitFieldErrors(
  errors: Record<string, string>,
  knownFields: readonly string[],
): { fields: Record<string, string>; unmapped: string[] } {
  const fields: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const [field, message] of Object.entries(errors)) {
    if (knownFields.includes(field)) {
      fields[field] = message;
    } else {
      unmapped.push(message);
    }
  }

  return { fields, unmapped };
}
