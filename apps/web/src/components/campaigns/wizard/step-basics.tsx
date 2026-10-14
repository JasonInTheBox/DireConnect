import { Badge } from "@/components/ui/badge";
import { TextField } from "@/components/ui/field";

export function StepBasics({
  title,
  error,
  onChange,
}: {
  title: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <TextField
        label="Campaign name"
        required
        autoComplete="off"
        hint="Customers see this as the email subject."
        value={title}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-ink">Channel</p>
        <p>
          <Badge icon="send">Email</Badge>
        </p>
        <p className="text-xs text-muted">Campaigns are sent by email.</p>
      </div>
    </div>
  );
}
