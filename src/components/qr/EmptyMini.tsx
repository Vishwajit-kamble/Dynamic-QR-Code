import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyMiniProps {
  title: string;
  description: string;
  action: () => void;
}

export function EmptyMini({ title, description, action }: EmptyMiniProps) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center text-center">
      <FileText className="size-6 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={action}>
        <Plus /> Create code
      </Button>
    </div>
  );
}
