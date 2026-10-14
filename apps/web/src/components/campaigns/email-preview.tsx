/** What the customer will roughly see. The subject is the campaign name; an unsubscribe link is always added. */
export function EmailPreview({
  businessName,
  subject,
  message,
}: {
  businessName: string;
  subject: string;
  message: string;
}) {
  return (
    <section aria-labelledby="email-preview-heading" className="space-y-2">
      <h3 id="email-preview-heading" className="text-[13px] font-medium text-ink">
        Email preview
      </h3>
      <div className="overflow-hidden rounded-container border border-line bg-canvas">
        <dl className="space-y-1 border-b border-line bg-surface px-4 py-3 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">From</dt>
            <dd className="min-w-0 truncate text-ink">{businessName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">Subject</dt>
            <dd className="min-w-0 break-words font-medium text-ink">
              {subject.trim() || <span className="font-normal text-muted">Your campaign name</span>}
            </dd>
          </div>
        </dl>
        <div className="px-4 py-4 text-sm text-ink">
          {message.trim() ? (
            <p className="whitespace-pre-wrap break-words">{message}</p>
          ) : (
            <p className="text-muted">Your message will appear here.</p>
          )}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Every email includes an unsubscribe link.
        </p>
      </div>
    </section>
  );
}
