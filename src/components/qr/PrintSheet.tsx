import { QRCodeSVG } from "qrcode.react";
import { isUnlinkedDestination } from "@/lib/qr-workspace";
import type { QRRecord } from "@/components/qr/types";

interface PrintSheetProps {
  records: QRRecord[];
  origin: string;
  printTargetId?: string | string[] | null;
}

export function PrintSheet({ records, origin, printTargetId }: PrintSheetProps) {
  if (!origin) return null;

  const visibleRecords = Array.isArray(printTargetId)
    ? records.filter((code) => printTargetId.includes(code.id))
    : printTargetId && printTargetId !== "all"
      ? records.filter((code) => code.id === printTargetId)
      : records.filter((code) => code.is_active || isUnlinkedDestination(code.destination_url));

  return (
    <div className="print-sheet" aria-hidden="true">
      {visibleRecords.map((code) => {
        const isUnlinked = isUnlinkedDestination(code.destination_url);
        return (
          <article key={code.id} className="print-label" data-print-id={code.id}>
            <QRCodeSVG value={`${origin}/r/${code.code}`} size={152} level="Q" includeMargin />
            <div>
              <p className="print-tracking-id">{code.tracking_id}</p>
              <h2>{code.name}</h2>
              <p className="print-card-id">ID: {code.code}</p>
              <p className={isUnlinked ? "print-card-hint" : undefined}>
                {isUnlinked ? "Dynamic Google Review Card" : code.destination_url}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
