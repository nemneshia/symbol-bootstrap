import { Logger } from '../logger';
/**
 * Service handling files and how to store and load them on the file system.
 */
export declare class FileSystemService {
    private readonly logger;
    constructor(logger: Logger);
    validateFolder(workingDirFullPath: string): void;
    validateSeedFolder(nemesisSeedFolder: string, message: string): void;
    deleteFile(file: string): void;
    mkdir(path: string): Promise<void>;
    mkdirParentFolder(fileName: string): Promise<void>;
    copyDir(copyFrom: string, copyTo: string, excludeFiles?: string[], includeFiles?: string[]): Promise<void>;
    deleteFolder(folder: string, excludeFiles?: string[]): void;
    private deleteFolderRecursive;
    getFilesRecursively(originalPath: string): string[];
    getTargetFolder(target: string, absolute: boolean, ...paths: string[]): string;
    getTargetNodesFolder(target: string, absolute: boolean, ...paths: string[]): string;
    getTargetGatewayFolder(target: string, absolute: boolean, ...paths: string[]): string;
    getTargetNemesisFolder(target: string, absolute: boolean, ...paths: string[]): string;
    getTargetDatabasesFolder(target: string, absolute: boolean, ...paths: string[]): string;
    download(url: string, dest: string): Promise<{
        downloaded: boolean;
        fileLocation: string;
    }>;
    chmodRecursive(path: string, mode: string | number): Promise<void>;
}
