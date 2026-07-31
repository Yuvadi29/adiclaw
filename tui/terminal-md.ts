import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

let ready = false;

function ensureMarked(): void {
    if (ready) return;
    const w = Math.max(40, Math.min(process.stdout.columns || 80, 120));
    const terminalExtension = markedTerminal({
        width: w,
        reflowText: true
    }, {});

    // @ts-ignore
    const defaultCode = terminalExtension.renderer.code;
    // @ts-ignore
    terminalExtension.renderer.code = function(code: string, lang: string, escaped: boolean) {
        if (lang === 'mermaid') {
            try {
                const { renderMermaidASCII } = require("beautiful-mermaid");
                return renderMermaidASCII(code, {}) + '\n';
            } catch (e) {
                return code + '\n';
            }
        }
        return defaultCode.call(this, code, lang, escaped);
    };

    // @ts-ignore
    marked.use(terminalExtension);
    ready = true;
}

export function renderTerminalMarkdown(source: string): string {
    ensureMarked();
    return marked.parse(source.trimEnd(), { async: false }) as string;
}