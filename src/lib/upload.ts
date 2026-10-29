import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type ImageUpload = {
  bytes: ArrayBuffer;
  ext: string; // for the storage path, e.g. 'jpg'
  contentType: string; // e.g. 'image/jpeg'
};

// Every image format starts with a known signature, so the real type comes
// from the bytes rather than the URI, which can be missing an extension or
// say .heic for a photo the picker already converted.
function detectType(bytes: ArrayBuffer): Omit<ImageUpload, 'bytes'> | null {
  const b = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16));
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', contentType: 'image/png' };
  if (ascii(0, 4) === 'GIF8') return { ext: 'gif', contentType: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand.startsWith('avi')) return { ext: 'avif', contentType: 'image/avif' };
    return { ext: 'heic', contentType: 'image/heic' };
  }
  return null;
}

// Longest side of an uploaded photo. Plenty for a full-screen phone view,
// and it keeps 4 MB camera files down to a few hundred KB.
const MAX_SIDE = 2048;

// Re-encodes a picked photo as a JPEG no bigger than MAX_SIDE. iPhones hand
// over HEIC, which Android can't display, so everything is saved as JPEG.
async function toJpeg(uri: string) {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const longest = Math.max(original.width, original.height);

  let image = original;
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    image = await ImageManipulator.manipulate(uri)
      .resize({ width: Math.round(original.width * scale), height: Math.round(original.height * scale) })
      .renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

// Reads a picked photo for a Supabase Storage upload.
// fetch(localUri) works on iOS but on Android it can return the text
// "File not found" instead of the image, which then uploads as a broken
// 14-byte file. expo-file-system reads local files on both platforms.
export async function readImage(uri: string): Promise<ImageUpload> {
  let jpegUri: string | null = null;
  try {
    jpegUri = await toJpeg(uri);
  } catch (err) {
    // Fall back to the file as picked rather than blocking the post
    console.log('Couldn’t convert photo to JPEG:', err);
  }

  const bytes = await new File(jpegUri ?? uri).arrayBuffer();

  // A real photo is never this small; refuse instead of uploading junk
  if (bytes.byteLength < 1024) {
    throw new Error('Couldn’t read that photo. Try picking it again.');
  }
  return { bytes, ...(detectType(bytes) ?? { ext: 'jpg', contentType: 'image/jpeg' }) };
}
