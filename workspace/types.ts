export interface IndexedFile {
    path: string;
    name: string;
    extension: string;
    size: number;
    modified: number;
};

export interface WorkspaceStats {
    totalFiles: number;
    totalDirectories: number;
    indexedAt: number;
};