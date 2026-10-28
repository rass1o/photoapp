import { File } from 'expo-file-system';

// Reads a picked photo into bytes for a Supabase Storage upload.
// fetch(localUri) works on iOS but on Android it can return the text
// "File not found" instead of the image, which then uploads as a broken
// 14-byte file. expo-file-system reads local files on both platforms.
export async function readImageFile(uri: string): Promise<ArrayBuffer> {
  const bytes = await new File(uri).arrayBuffer();

  // A real photo is never this small; refuse instead of uploading junk
  if (bytes.byteLength < 1024) {
    throw new Error('Couldn’t read that photo. Try picking it again.');
  }
  return bytes;
}

export function imageContentType(fileExt: string) {
  const ext = fileExt.toLowerCase();
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}
