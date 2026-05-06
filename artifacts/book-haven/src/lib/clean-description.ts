export function cleanDescription(raw?: string | { value: string } | null): string {
  if (!raw) return "";
  const text = typeof raw === "string" ? raw : raw.value;
  if (!text) return "";

  let s = text;

  s = s.replace(/\(\[Source\]\[\d+\]\)/gi, "");
  s = s.replace(/\(\[?source\]?\]?\([^)]+\)\)/gi, "");
  s = s.replace(/\(?source[:\s]*https?:\/\/\S+\)?/gi, "");

  s = s.replace(/\[(\d+)\]:\s*https?:\/\/\S+/g, "");

  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\[\d+\]/g, "$1");

  s = s.replace(/<[^>]+>/g, "");

  s = s.replace(/https?:\/\/\S+/g, "");

  s = s.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");

  return s.trim();
}

export function isMeaningfulDescription(text: string): boolean {
  return text.length >= 80;
}
