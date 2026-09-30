import type { ImportPreview, ReadingBackupPayloadV1 } from '../../../apps/client/src/types';
import type { ParsedReadingImport } from '../../../apps/client/src/services/dataPortability';
import { request } from './state';
const payload: ReadingBackupPayloadV1 = { manifest: { format: 'brack-reading-backup', version: 1, exported_at: '2026-10-01T12:00:00Z',
  app_version: 'fixture', user_id: 'shell-reader', encrypted: false, includes_media: false, media: [],
  record_counts: { books: 2, book_lists: 0, book_list_items: 0, progress_logs: 0, reading_sessions: 0, journal_entries: 0, goals: 0 } },
  books: [], book_lists: [], book_list_items: [], progress_logs: [], reading_sessions: [], journal_entries: [], goals: [], preferences: null };
const preview: ImportPreview = { import_id: 'import-fixture', source_format: 'csv', valid: 2, duplicates: 1, mergeable: 1, skipped: 0,
  invalid: 0, issues: [], books: [
    { source_index: 0, action: 'create', existing_book_id: null, book: { title: 'Reading slowly' }, warnings: [] },
    { source_index: 1, action: 'merge', existing_book_id: 'book-existing', book: { title: 'Returning to a chapter' }, warnings: [] },
  ] };
export async function parseReadingImport(file: File, passphrase?: string): Promise<ParsedReadingImport> {
  await request('import-parse', { name: file.name, size: file.size, passphrase });
  return { payload: structuredClone(payload), sourceFormat: 'csv' };
}
export async function previewReadingImport(id: string, parsed: ParsedReadingImport) {
  await request('import-preview', { id, sourceFormat: parsed.sourceFormat }); return structuredClone(preview);
}
export async function commitReadingImport(id: string, parsed: ParsedReadingImport, checked: ImportPreview) {
  await request('import-commit', { id, sourceFormat: parsed.sourceFormat, preview: checked });
  return { import_id: checked.import_id, created: 1, merged: 1, skipped: 0, failed: 0, errors: [] };
}
export async function collectReadingBackup(id: string, options: unknown) {
  await request('export', { id, options }); return { archive: new Uint8Array([1, 2, 3]), csv: 'Title,Author\nReading slowly,Alex' };
}
export const encryptBackup = async (archive: Uint8Array) => archive;
export const saveExportFile = async () => undefined;
