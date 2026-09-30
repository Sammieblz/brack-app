import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  collectReadingBackup,
  commitReadingImport,
  encryptBackup,
  parseReadingImport,
  previewReadingImport,
  saveExportFile,
  type ParsedReadingImport,
} from "@/services/dataPortability";
import type { ImportPreview } from "@/types";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { useSettingsTask } from "@/contexts/SettingsTaskContext";

interface DataBackupSettingsProps {
  user: { id: string };
}

const DataBackupSettingsContent = ({ user }: DataBackupSettingsProps) => {
  const { toast } = useToast();
  const id = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ParsedReadingImport | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [working, setWorking] = useState(false);
  const [operation, setOperation] = useState<"export" | "preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useSettingsTask({ dirty: Boolean(selectedFile || parsedImport || preview || passphrase || importPassphrase), pending: working });

  const begin = (next: NonNullable<typeof operation>) => {
    if (pending.current || !mounted.current) return false;
    pending.current = true;
    setWorking(true); setOperation(next); setError(null);
    return true;
  };
  const finish = () => {
    if (!mounted.current) return;
    pending.current = false; setWorking(false); setOperation(null);
  };

  const exportDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleExport = async (format: "archive" | "csv") => {
    if (!begin("export")) return;
    try {
      const backup = await collectReadingBackup(user.id, { includeMedia });
      if (!mounted.current) return;
      if (format === "csv") {
        await saveExportFile(
          new TextEncoder().encode(backup.csv),
          `brack-library-${exportDate}.csv`,
          "text/csv"
        );
      } else {
        const archive = encrypt
          ? await encryptBackup(backup.archive, passphrase)
          : backup.archive;
        if (!mounted.current) return;
        await saveExportFile(
          archive,
          `brack-reading-backup-${exportDate}.${encrypt ? "brack" : "zip"}`,
          encrypt ? "application/octet-stream" : "application/zip"
        );
      }
      if (mounted.current) toast({ title: "Backup ready", description: "Your reading data was exported." });
    } catch (error) {
      if (!mounted.current) return;
      setError(error instanceof Error ? error.message : "Could not export reading data");
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export reading data",
        variant: "destructive",
      });
    } finally {
      finish();
    }
  };

  const handlePreview = async () => {
    if (!selectedFile || !begin("preview")) return;
    try {
      const parsed = await parseReadingImport(selectedFile, importPassphrase || undefined);
      if (!mounted.current) return;
      const nextPreview = await previewReadingImport(user.id, parsed);
      if (!mounted.current) return;
      setParsedImport(parsed);
      setPreview(nextPreview);
    } catch (error) {
      if (!mounted.current) return;
      setParsedImport(null);
      setPreview(null);
      setError(error instanceof Error ? error.message : "Invalid backup file");
      toast({
        title: "Import could not be read",
        description: error instanceof Error ? error.message : "Invalid backup file",
        variant: "destructive",
      });
    } finally {
      finish();
    }
  };

  const handleCommit = async () => {
    if (!parsedImport || !preview || !begin("import")) return;
    try {
      const result = await commitReadingImport(user.id, parsedImport, preview);
      if (!mounted.current) return;
      toast({
        title: "Import complete",
        description: `${result.created} added, ${result.merged} merged, ${result.failed} failed.`,
      });
      setSelectedFile(null);
      setParsedImport(null);
      setPreview(null);
      setImportPassphrase("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (!mounted.current) return;
      setError(error instanceof Error ? error.message : "Could not import reading data");
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import reading data",
        variant: "destructive",
      });
    } finally {
      finish();
    }
  };

  return (
    <div className="space-y-5" aria-busy={working}>
      <div>
        <h2 className="font-display text-2xl font-semibold">Data & Backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep a portable copy of your reading history or merge data from Brack, CSV, and Goodreads.
        </p>
      </div>

      <fieldset disabled={working} aria-describedby={error ? `${id}-error` : undefined} className="min-w-0 space-y-5">
      <legend className="sr-only">Reading data backup and import</legend>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export reading data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={includeMedia}
              onCheckedChange={(checked) => setIncludeMedia(checked === true)}
            />
            <span>
              <span className="block text-sm font-medium">Include owned journal and progress media</span>
              <span className="block text-xs text-muted-foreground">
                External book cover URLs remain links.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <Checkbox
              checked={encrypt}
              onCheckedChange={(checked) => setEncrypt(checked === true)}
            />
            <span>
              <span className="block text-sm font-medium">Encrypt with a passphrase</span>
              <span className="block text-xs text-muted-foreground">
                Creates an AES-GCM encrypted .brack file.
              </span>
            </span>
          </label>
          {encrypt && (
            <div className="space-y-2">
              <Label htmlFor="backup-passphrase">Backup passphrase</Label>
              <Input
                id="backup-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="h-auto max-w-full whitespace-normal"
              onClick={() => void handleExport("archive")}
              disabled={working || (encrypt && passphrase.length < 8)}
            >
              <AppIcon icon={APP_ICONS.common.download} variant="action" className="mr-2" />
              Export full backup
            </Button>
            <Button className="h-auto max-w-full whitespace-normal" variant="outline" onClick={() => void handleExport("csv")} disabled={working}>
              Export library CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import and merge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Import never deletes your current data. Brack previews duplicates and merges compatible reading state.
            </AlertDescription>
          </Alert>
          <Input
            ref={fileInputRef}
            aria-label="Import backup file"
            type="file"
            accept=".zip,.brack,.json,.csv,application/zip,application/json,text/csv"
            onChange={(event) => {
              if (pending.current) return;
              setSelectedFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setParsedImport(null);
              setError(null);
            }}
          />
          {selectedFile?.name.toLowerCase().endsWith(".brack") && (
            <div className="space-y-2">
              <Label htmlFor="import-passphrase">Backup passphrase</Label>
              <Input
                id="import-passphrase"
                type="password"
                value={importPassphrase}
                onChange={(event) => setImportPassphrase(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => void handlePreview()}
            disabled={!selectedFile || working}
          >
            Preview import
          </Button>

          {preview && (
            <div className="rounded-md border border-border p-4">
              <h3 className="font-medium">Import preview</h3>
              <dl className="mt-3 grid gap-3 text-sm" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 6rem), 1fr))" }}>
                <div><dt className="text-muted-foreground">Valid</dt><dd>{preview.valid}</dd></div>
                <div><dt className="text-muted-foreground">New</dt><dd>{preview.valid - preview.mergeable}</dd></div>
                <div><dt className="text-muted-foreground">Merge</dt><dd>{preview.mergeable}</dd></div>
                <div><dt className="text-muted-foreground">Skipped</dt><dd>{preview.skipped}</dd></div>
                <div><dt className="text-muted-foreground">Invalid</dt><dd>{preview.invalid}</dd></div>
              </dl>
              <Button className="mt-4" onClick={() => void handleCommit()} disabled={working}>
                Import {preview.valid} records
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </fieldset>
      {working && <p role="status" className="text-sm text-muted-foreground">{operation === "export" ? "Preparing your export…" : operation === "preview" ? "Preparing your import preview…" : "Importing your reading data…"}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export const DataBackupSettings = ({ user }: DataBackupSettingsProps) => <DataBackupSettingsContent key={user.id} user={user} />;
