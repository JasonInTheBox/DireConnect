import { EmailPreview } from "@/components/campaigns/email-preview";
import { TextAreaField } from "@/components/ui/field";

export function StepMessage({
  title,
  message,
  error,
  businessName,
  onChange,
}: {
  title: string;
  message: string;
  error: string | undefined;
  businessName: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
      <TextAreaField
        label="Message"
        required
        rows={10}
        className="min-h-48"
        hint={`${message.length} characters. Line breaks are kept.`}
        value={message}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <EmailPreview businessName={businessName} subject={title} message={message} />
    </div>
  );
}
