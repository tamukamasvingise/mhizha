// The logo and signature files on the phone. Each is copied into the app's own
// `files` folder under a new name and recorded with its checksum; a new
// picture is a new file, never an overwrite. Paths are kept relative to the
// app's document folder so a Restore on another phone finds them.
import { getRandomBytes } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { uuidv7, type Db } from '../db';
import { fileRecord, saveFile, SetupError, type FileKind } from './store';

const FOLDER = 'files';
/** Big enough for any logo; keeps Backups small. */
export const MAX_PICTURE_BYTES = 2 * 1024 * 1024;

function newFile(ext: string): { file: File; path: string } {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  const name = `${uuidv7(Date.now(), getRandomBytes)}.${ext}`;
  return { file: new File(dir, name), path: `${FOLDER}/${name}` };
}

async function keep(db: Db, kind: FileKind, file: File, path: string): Promise<string> {
  const checksum = await file.digest('SHA-256');
  return saveFile(db, { kind, path, checksum, size: file.size });
}

/** Lets the User pick a PNG or JPEG picture and keeps a copy. Null if they cancel. */
export async function pickPicture(db: Db, kind: FileKind): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/png', 'image/jpeg'] });
  if (picked.canceled) return null;
  const source = picked.result;
  if (source.size > MAX_PICTURE_BYTES) throw new SetupError('That picture is too big. Pick one under 2 MB.');
  const { file, path } = newFile(source.type === 'image/png' ? 'png' : 'jpg');
  await source.copy(file);
  return keep(db, kind, file, path);
}

/** Keeps a drawn signature (SVG text). */
export async function keepSignature(db: Db, svg: string): Promise<string> {
  const { file, path } = newFile('svg');
  file.create();
  file.write(svg);
  return keep(db, 'signature', file, path);
}

/** The file's address on this phone, for showing it. */
export function fileUri(db: Db, id: string): string | null {
  const r = fileRecord(db, id);
  return r ? new File(Paths.document, r.path).uri : null;
}

/** The text of a kept SVG file, or null if it cannot be read. */
export function fileText(db: Db, id: string): string | null {
  const r = fileRecord(db, id);
  if (!r) return null;
  try {
    return new File(Paths.document, r.path).textSync();
  } catch {
    return null;
  }
}
