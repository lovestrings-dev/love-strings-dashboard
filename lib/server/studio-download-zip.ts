// Store MP4s without recompression, streaming one cloud object at a time.
// ZIP32 is sufficient for this bounded (eight files, <4 GiB) download.
export type ZipVideo = { name: string; size: number; open: () => AsyncIterable<Uint8Array> };
const limit = 0xffffffff;
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function header(length: number, signature: number) {
  const bytes = Buffer.alloc(length);
  bytes.writeUInt32LE(signature, 0);
  return bytes;
}
export function validateZipVideos(files: ZipVideo[]) {
  if (!files.length || files.length > 8) throw new Error("Choose up to eight completed videos.");
  const names = new Set<string>();
  let size = 22;
  for (const file of files) {
    if (!/^Video-[1-8]\.mp4$/.test(file.name) || names.has(file.name) || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error("Invalid video archive.");
    names.add(file.name);
    size += file.size + 30 + 16 + 46 + Buffer.byteLength(file.name) * 2;
    if (size >= limit) throw new Error("These videos exceed the 4 GB ZIP limit. Download them individually.");
  }
}
export async function* streamVideoZip(files: ZipVideo[]) {
  validateZipVideos(files);
  const directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const local = header(30, 0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0808, 6); // UTF-8 names and trailing data descriptor.
    local.writeUInt16LE(33, 12); // 1980-01-01, ZIP's first representable date.
    local.writeUInt16LE(name.length, 26);
    const start = offset;
    yield local; yield name;
    offset += local.length + name.length;
    let crc = 0xffffffff, size = 0;
    for await (const chunk of file.open()) {
      size += chunk.byteLength;
      if (size > file.size) throw new Error("A video changed during download. Try again.");
      for (const byte of chunk) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
      yield chunk;
      offset += chunk.byteLength;
    }
    if (size !== file.size) throw new Error("Incomplete video download. Try again.");
    crc = (crc ^ 0xffffffff) >>> 0;
    const descriptor = header(16, 0x08074b50);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(size, 8);
    descriptor.writeUInt32LE(size, 12);
    yield descriptor;
    offset += descriptor.length;
    const entry = header(46, 0x02014b50);
    entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0808, 8); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(size, 20); entry.writeUInt32LE(size, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(start, 42);
    directory.push(entry, name);
  }
  const directoryStart = offset;
  for (const entry of directory) { yield entry; offset += entry.length; }
  const end = header(22, 0x06054b50);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(offset - directoryStart, 12); end.writeUInt32LE(directoryStart, 16);
  yield end;
}
