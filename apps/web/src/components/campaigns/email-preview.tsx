/**
 * What the customer roughly sees, mirroring the worker's email template: the subject is the
 * campaign name; the body opens with a "Promotion from <business>" header, then the campaign
 * name, your message, an opt-in line with an unsubscribe link, and a "Powered by DireConnect"
 * footer. Emails are sent from DireConnect's own sending address, not from the business, so no
 * sender row is shown.
 */
export function EmailPreview({
  businessName,
  subject,
  message,
}: {
  businessName: string;
  subject: string;
  message: string;
}) {
  const title = subject.trim();

  return (
    <section aria-labelledby="email-preview-heading" className="space-y-2">
      <h3 id="email-preview-heading" className="text-[13px] font-medium text-ink">
        Email preview
      </h3>
      <div className="overflow-hidden rounded-container border border-line bg-canvas">
        <dl className="border-b border-line bg-surface px-4 py-3 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">Subject</dt>
            <dd className="min-w-0 break-words font-medium text-ink">
              {title || <span className="font-normal text-muted">Your campaign name</span>}
            </dd>
          </div>
        </dl>
        <div className="border-b border-line bg-sunken px-4 py-3">
          <p className="break-words text-sm">
            <span className="text-xs text-muted">Promotion from </span>
            <span className="font-semibold text-ink">{businessName}</span>
          </p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm text-ink">
          <p className="break-words font-semibold">
            {title || <span className="font-normal text-muted">Your campaign name</span>}
          </p>
          {message.trim() ? (
            <p className="whitespace-pre-wrap break-words">{message}</p>
          ) : (
            <p className="text-muted">Your message will appear here.</p>
          )}
        </div>
        <div className="space-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
          <p>
            You are receiving this email because you opted in to promotions from {businessName}.{" "}
            <span className="underline">Unsubscribe</span>
          </p>
          <p>Powered by DireConnect</p>
        </div>
      </div>
      <p className="text-xs text-muted">
        Every email includes an unsubscribe link. It is sent from DireConnect’s sending address,
        with your business name in the header. If your business has a website, a “Visit Website”
        button is added.
      </p>
    </section>
  );
}
