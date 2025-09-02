export function areContentsEqual(content1: string, content2: string): boolean {
    // Normalize content by trimming whitespace and removing extra line breaks
    const normalize = (content: string) => content.trim().replace(/\s+/g, ' ');
    return normalize(content1) === normalize(content2);
}