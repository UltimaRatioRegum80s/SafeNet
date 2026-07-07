export async function uploadImages(files: File[], signal?: AbortSignal) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch("/api/uploads", {
    method: "POST",
    body: form,
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return json.files as Array<{ url: string; width?: number; height?: number; size?: number; format?: string }>;
}