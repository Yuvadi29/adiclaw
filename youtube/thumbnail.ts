import terminalImage from "terminal-image";
import chalk from "chalk";

export interface ThumbnailRenderOptions {
  width?: number | string; // e.g. 40, "50%", "100%"
  height?: number | string;
  preserveAspectRatio?: boolean;
}

/**
 * Fetch image data from URL or local file path as a Buffer
 */
export async function fetchImageBuffer(urlOrPath: string): Promise<Buffer | null> {
  if (!urlOrPath || !urlOrPath.trim()) return null;

  try {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      const response = await fetch(urlOrPath);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } else {
      const file = Bun.file(urlOrPath);
      if (!(await file.exists())) return null;
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch {
    return null;
  }
}

/**
 * Render YouTube thumbnail directly in the terminal using terminal-image
 * (automatically uses iTerm2, Kitty, Sixel, or 24-bit TrueColor ANSI half-blocks)
 */
export async function renderTerminalThumbnail(
  imageUrlOrBuffer: string | Buffer | ArrayBuffer | Uint8Array,
  options?: ThumbnailRenderOptions
): Promise<string> {
  try {
    let buffer: Buffer | null = null;

    if (typeof imageUrlOrBuffer === "string") {
      buffer = await fetchImageBuffer(imageUrlOrBuffer);
    } else if (Buffer.isBuffer(imageUrlOrBuffer)) {
      buffer = imageUrlOrBuffer;
    } else {
      buffer = Buffer.from(imageUrlOrBuffer);
    }

    if (!buffer) {
      const rawUrl = typeof imageUrlOrBuffer === "string" ? imageUrlOrBuffer : "binary";
      return chalk.dim(`  [🖼️ Thumbnail unavailable: ${rawUrl}]`);
    }

    const rendered = await terminalImage.buffer(buffer, {
      width: options?.width ?? 40,
      height: options?.height,
      preserveAspectRatio: options?.preserveAspectRatio ?? true,
    });

    return rendered;
  } catch (error) {
    const rawUrl = typeof imageUrlOrBuffer === "string" ? imageUrlOrBuffer : "";
    return [
      chalk.hex("#FF0000")("  ┏━━ 🖼️ YOUTUBE THUMBNAIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"),
      chalk.hex("#94A3B8")(`  ┃ Source: ${chalk.white(rawUrl.slice(0, 48))} ┃`),
      chalk.hex("#FF0000")("  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"),
    ].join("\n");
  }
}

/**
 * Convenience helper to directly print a thumbnail to console
 */
export async function displayThumbnail(
  imageUrlOrBuffer: string | Buffer | ArrayBuffer | Uint8Array,
  options?: ThumbnailRenderOptions
): Promise<void> {
  const output = await renderTerminalThumbnail(imageUrlOrBuffer, options);
  if (output) {
    console.log(output);
  }
}


