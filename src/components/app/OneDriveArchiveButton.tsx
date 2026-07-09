import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { archiveToOneDrive } from "@/lib/onedrive.functions";
import { Button } from "@/components/ui/button";

type Props = {
  folder: string;
  filename: string;
  /** Callback that produces the file bytes on demand. Return a Blob or Uint8Array. */
  getBlob: () => Promise<Blob>;
  className?: string;
};

/** Archive-a-PDF-to-OneDrive button. Requires Microsoft OneDrive connector. */
export function OneDriveArchiveButton({ folder, filename, getBlob, className }: Props) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const fn = useServerFn(archiveToOneDrive);
  const m = useMutation({
    mutationFn: async () => {
      const blob = await getBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const contentBase64 = btoa(bin);
      return fn({ data: { folder, filename, contentBase64, contentType: blob.type || "application/pdf" } });
    },
    onSuccess: (r) => { setSavedUrl(r.webUrl); toast.success("تم الأرشفة إلى OneDrive"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (savedUrl) {
    return (
      <a href={savedUrl} target="_blank" rel="noreferrer" className={"inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-success/15 text-success " + (className ?? "")}>
        <CheckCircle2 className="h-3.5 w-3.5" /> مؤرشف <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()} className={"gap-1 " + (className ?? "")}>
      <Cloud className="h-3.5 w-3.5" /> {m.isPending ? "..." : "أرشفة OneDrive"}
    </Button>
  );
}
