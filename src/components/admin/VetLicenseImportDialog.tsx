import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  runLicenseImport, updateLicenseSource, uploadImportFile,
  type ImportSummary, type VetLicenseSource,
} from "@/lib/vet-licenses-api";
import { Loader2, UploadCloud } from "lucide-react";

interface Props {
  source: VetLicenseSource | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

const METHODS = [
  { value: "api", label: "API sync" },
  { value: "bulk_file", label: "Downloadable file (URL)" },
  { value: "manual_upload", label: "Admin file upload" },
  { value: "none_yet", label: "Not configured" },
];

const FORMATS = ["csv", "tsv", "xlsx", "json", "fixed_width"];

export default function VetLicenseImportDialog({ source, open, onOpenChange, onDone }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<VetLicenseSource>>({});
  const [mappingText, setMappingText] = useState("{}");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "commit" | "save">(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!source) return;
    setForm({
      import_method: source.import_method,
      source_url: source.source_url,
      file_format: source.file_format,
      refresh_cadence_days: source.refresh_cadence_days,
      auto_sync_enabled: source.auto_sync_enabled,
      is_full_snapshot: source.is_full_snapshot,
      notes: source.notes,
    });
    setMappingText(JSON.stringify(source.mapping ?? {}, null, 2));
    setFile(null);
    setPreview(null);
  }, [source]);

  if (!source) return null;

  async function saveConfig() {
    let mapping: Record<string, unknown>;
    try { mapping = JSON.parse(mappingText || "{}"); }
    catch { toast({ title: "Field mapping is not valid JSON", variant: "destructive" }); return; }
    setBusy("save");
    try {
      await updateLicenseSource(source!.state_code, { ...form, mapping });
      toast({ title: `${source!.state_name} source settings saved` });
      onDone();
    } catch (e) {
      toast({ title: "Could not save settings", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  async function runImport(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "commit");
    setPreview(null);
    try {
      let filePath: string | null = null;
      if (file) filePath = await uploadImportFile(source!.state_code, file);
      const summary = await runLicenseImport({
        state_code: source!.state_code,
        file_path: filePath,
        source_url: filePath ? null : (form.source_url ?? null),
        file_format: form.file_format ?? null,
        dry_run: dryRun,
      });
      setPreview(summary);
      if (summary.status === "failed") {
        toast({ title: "Import failed", description: summary.error_message, variant: "destructive" });
      } else if (!dryRun) {
        toast({
          title: `${source!.state_name} imported`,
          description: `${summary.rows_kept} active veterinary licenses stored.`,
        });
        onDone();
      }
    } catch (e) {
      toast({ title: "Import error", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source.state_name} — license import</DialogTitle>
          <DialogDescription>{source.authority}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Import method</Label>
              <Select
                value={form.import_method ?? "manual_upload"}
                onValueChange={(v) => setForm({ ...form, import_method: v as VetLicenseSource["import_method"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>File format</Label>
              <Select
                value={form.file_format ?? "csv"}
                onValueChange={(v) => setForm({ ...form, file_format: v as VetLicenseSource["file_format"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Source URL (API or downloadable file)</Label>
            <Input
              value={form.source_url ?? ""}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Refresh cadence (days)</Label>
              <Input
                type="number" min={1}
                value={form.refresh_cadence_days ?? 7}
                onChange={(e) => setForm({ ...form, refresh_cadence_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Automatic sync</Label>
                <Switch
                  checked={!!form.auto_sync_enabled}
                  onCheckedChange={(v) => setForm({ ...form, auto_sync_enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-normal">Source is a full snapshot</Label>
                <Switch
                  checked={form.is_full_snapshot !== false}
                  onCheckedChange={(v) => setForm({ ...form, is_full_snapshot: v })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Field mapping (JSON)</Label>
            <Textarea
              rows={6} className="font-mono text-xs"
              value={mappingText}
              onChange={(e) => setMappingText(e.target.value)}
              placeholder='{"full_name":"LicenseeName","license_number":"LicenseNo","license_status":"Status","license_type":"LicenseType"}'
            />
            <p className="text-xs text-muted-foreground">
              Only needed when the file's column names differ from the common defaults.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Upload source file (optional — overrides the URL for this run)</Label>
            <Input
              type="file"
              accept=".csv,.tsv,.txt,.json,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={saveConfig} disabled={busy !== null}>
              {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save settings
            </Button>
            <Button variant="secondary" onClick={() => runImport(true)} disabled={busy !== null}>
              {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preview
            </Button>
            <Button onClick={() => runImport(false)} disabled={busy !== null}>
              {busy === "commit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Import now
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={preview.status === "failed" ? "destructive" : "secondary"}>
                  {preview.dry_run ? "Preview" : "Committed"}
                </Badge>
                <span className="text-muted-foreground">
                  {preview.rows_read} rows read · {preview.rows_kept} kept
                </span>
              </div>
              {preview.error_message && (
                <p className="text-destructive">{preview.error_message}</p>
              )}
              <ul className="text-muted-foreground space-y-0.5">
                <li>Filtered — not active: {preview.rows_filtered_status}</li>
                <li>Filtered — not a standard veterinary license: {preview.rows_filtered_type}</li>
                <li>Unusable rows: {preview.rows_invalid}</li>
                {!preview.dry_run && (
                  <li>
                    Added {preview.rows_inserted} · Updated {preview.rows_updated} · Marked inactive {preview.rows_deactivated}
                  </li>
                )}
              </ul>
              {preview.sample_kept?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Sample of records that will be stored</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {preview.sample_kept.slice(0, 5).map((r, i) => (
                      <li key={i}>
                        {r.full_name} — #{r.license_number} — {r.city ?? "—"} — {r.license_type_raw ?? "veterinary license"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.error_samples?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Top filter reasons</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {preview.error_samples.slice(0, 6).map((s, i) => (
                      <li key={i}>{s.reason} × {s.count}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
