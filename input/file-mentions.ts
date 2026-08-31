export function extractFileMentions(text: string): string[] {
    const mentions = new Set<string>();
    const regex = /(?:^|\s)@([^\s]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) mentions.add(match[1]);
    }
    return Array.from(mentions);
}
