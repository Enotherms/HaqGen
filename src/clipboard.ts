interface CopyDoc {
  createElement(tag: "input"): { value: string; style: Partial<CSSStyleDeclaration> | Record<string, string>; focus(): void; select(): void };
  body: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown };
  execCommand(command: string): boolean;
}

interface Clip {
  writeText(text: string): Promise<void>;
}

export async function copyText(
  text: string,
  doc: CopyDoc = document as unknown as CopyDoc,
  clip: Clip | undefined = typeof navigator !== "undefined" ? navigator.clipboard : undefined
): Promise<boolean> {
  const input = doc.createElement("input");
  input.value = text;
  Object.assign(input.style, { position: "absolute", left: "-9999px", opacity: "0" });
  doc.body.appendChild(input);
  try {
    input.focus();
    input.select();
    try {
      if (doc.execCommand("copy")) return true;
    } catch {
    }
    if (!clip) return false;
    try {
      await clip.writeText(text);
      return true;
    } catch {
      return false;
    }
  } finally {
    doc.body.removeChild(input);
  }
}
