import { workspace } from "../workspace";
import path from "path";

export async function buildFileContents(mentions: string[]): Promise<string> {
    if (!mentions || mentions.length === 0) return "";
    
    let content = "";
    for (const mention of mentions) {
        const absolutePath = path.resolve(process.cwd(), mention);
        
        if (workspace.has(absolutePath)) {
            try {
                const fileContent = await workspace.read(absolutePath);
                content += `\n<file path="${mention}">\n${fileContent}\n</file>\n`;
            } catch (err) {
                console.warn(`Could not read mentioned file: ${mention}`);
            }
        } else {
            console.warn(`Could not find mentioned file in workspace: ${mention}`);
        }
    }
    
    return content;
}
