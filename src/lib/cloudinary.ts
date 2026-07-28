// Unsigned client-side upload to Cloudinary.
// Cloud + preset are public; no secret is exposed.
const CLOUD_NAME = "dbwonovw";
const UPLOAD_PRESET = "dnkwnq";

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { secure_url?: string; url?: string };
  const url = json.secure_url || json.url;
  if (!url) throw new Error("Upload did not return a URL");
  return url;
}
