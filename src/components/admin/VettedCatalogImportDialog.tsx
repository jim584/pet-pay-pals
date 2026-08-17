import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { runCatalogImport, uploadCatalogFile, type VettedImportSummary } from "@/lib/vetted-api";
import { Loader2, UploadCloud } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export default function VettedCatalogImportDialog({ open, onOpenChange, onDone }: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [fullCatalog, setFullCatalog] = useState(true);
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [preview, setPreview] = useState<VettedImportSummary | null>(null);

  async function run(dryRun: boolean) {
    if (!file) {
      toast({ title: "Choose a catalogue export first", variant: "destructive" });
      return;
    }
    setBusy(dryRun ? "preview" : "commit");
    if (dryRun) setPreview(null);
    try {
      const path = await uploadCatalogFile(file);
      const summary = await runCatalogImport({
        file_path: path,
        full_catalog: fullCatalog,
        dry_run: dryRun,
      });
      if (dryRun) {
        setPreview(summary);
      } else {
        toast({
          title: "Vetted catalogue synced",
          description: `${summary.created_count ?? 0} added, ${summary.updated_count ?? 0} updated, ${summary.delisted_count ?? 0} delisted.`,
        });
        setPreview(null);
        setFile(null);
        onOpenChange(false);
        onDone();
      }
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import the Vetted catalogue</DialogTitle>
          <DialogDescription>
            Upload an export of the approved-product catalogue from Vetted (CSV, TSV, JSON or XLSX).
            Products are matched on their Vetted product id, so re-importing updates rather than duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="catalogue-file">Catalogue export</Label>
            <Input
              id="catalogue-file"
              type="file"
              accept=".csv,.tsv,.json,.xlsx,.xls"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recognised columns include product id, name, description, url, image, store, brand, category,
              price, currency, sku, tags and approval status. Unrecognised categories fall back to "General".
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">This file is the complete approved catalogue</p>
              <p className="text-xs text-muted-foreground">
                Products missing from the file are marked delisted (never deleted). Turn this off for a partial update.
              </p>
            </div>
            <Switch checked={fullCatalog} onCheckedChange={setFullCatalog} />
          </div>

          {preview && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{preview.total_rows ?? 0} rows read</Badge>
                <Badge variant="secondary">{preview.approved_count ?? 0} approved</Badge>
                <Badge variant="secondary">{preview.not_approved_count ?? 0} not approved</Badge>
                <Badge variant="secondary">{preview.skipped_count} skipped</Badge>
              </div>
              {preview.sample && preview.sample.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {preview.sample.map((p, i) => (
                    <li key={i} className="truncate">
                      {p.name} — {p.store_name ?? "no store"} — {p.category}{p.price_text ? ` — ${p.price_text}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {preview.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-1">
                  {preview.errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                  {preview.errors.length > 10 && <p>+{preview.errors.length - 10} more</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => run(true)} disabled={busy !== null}>
              {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
            </Button>
            <Button onClick={() => run(false)} disabled={busy !== null || !file}>
              {busy === "commit"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><UploadCloud className="h-4 w-4 mr-1" /> Import catalogue</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
