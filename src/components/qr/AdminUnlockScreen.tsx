import { KeyRound, LoaderCircle, Lock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminUnlockScreenProps {
  onUnlock: (passcode: string) => Promise<void>;
}

export function AdminUnlockScreen({ onUnlock }: AdminUnlockScreenProps) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!passcode.trim()) {
      setError("Enter your admin passcode.");
      return;
    }
    setSubmitting(true);
    try {
      await onUnlock(passcode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Unlock QR Studio</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Customer QR scans stay live 24/7. Enter your admin passcode to manage cards.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-passcode" className="text-sm font-medium">
              Admin passcode
            </label>
            <Input
              id="admin-passcode"
              type="password"
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value);
                if (error) setError("");
              }}
              placeholder="Enter workspace passcode"
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
            {submitting ? "Unlocking…" : "Unlock workspace"}
          </Button>
        </form>
      </div>
    </div>
  );
}
