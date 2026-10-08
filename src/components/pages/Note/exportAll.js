/* Export every Daily Note (all days) from the web app.
   Fetching + download live here; the formats are built by shared/exportNotes.js
   (also used by the desktop app, so both produce the same files). */
import axiosInstance from '../../../axiosConfig';
import { buildExport } from '../../../../shared/exportNotes';
import { downloadFile } from './noteUtils';

/** format: 'md' | 'json' | 'zip'. Resolves with the build result ({ filename, stats }). */
export async function exportAllNotes(format, { onProgress } = {}) {
  const res = await axiosInstance.get('/api/DailyNote/all');
  const notes = (res.data || []).filter((n) => !n.isDeleted);
  if (!notes.length) throw new Error('no notes to export');
  const result = await buildExport(notes, { format, onProgress });
  downloadFile(result.filename, result.data, result.mime);
  return result;
}

/** One-line summary for a flash message / alert. */
export const describeExport = ({ filename, stats }) => {
  const parts = [`exported ${filename}`, `${stats.notes} notes`];
  if (stats.files) parts.push(`${stats.files} files`);
  if (stats.failed.length) parts.push(`${stats.failed.length} file(s) not downloaded — original links kept`);
  return parts.join(' · ');
};
