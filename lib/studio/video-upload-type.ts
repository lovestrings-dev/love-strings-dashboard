export function studioVideoUploadMimeType(file: Pick<File, "name" | "type">): string {
  if (file.type.toLowerCase().startsWith("video/")) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm" } as Record<string, string>)[extension ?? ""] ?? "video/mp4";
}
