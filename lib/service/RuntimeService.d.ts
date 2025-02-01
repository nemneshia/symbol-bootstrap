import { Logger } from '../logger';
export interface SpawnParams {
    command: string;
    args: string[];
    useLogger: boolean;
    logPrefix?: string;
    shell?: boolean;
}
export interface RunImageUsingExecParams {
    catapultAppFolder?: string;
    image: string;
    userId?: string;
    workdir?: string;
    cmds: string[];
    binds: string[];
    ignoreErrors?: boolean;
}
/**
 * Service in charge of running OS commands. Commands could be executed directly on the OS or via docker containers.
 */
export declare class RuntimeService {
    private readonly logger;
    private static readonly pulledImages;
    private static dockerUserId;
    static readonly CURRENT_USER = "current";
    constructor(logger: Logger);
    exec(runCommand: string, ignoreErrors?: boolean): Promise<{
        stdout: string;
        stderr: string;
    }>;
    runImageUsingExec({ catapultAppFolder, image, userId, workdir, cmds, binds, ignoreErrors, }: RunImageUsingExecParams): Promise<{
        stdout: string;
        stderr: string;
    }>;
    spawn({ command, args, useLogger, logPrefix, shell }: SpawnParams): Promise<string>;
    pullImage(image: string): Promise<void>;
    getDockerUserGroup(): Promise<string | undefined>;
    resolveDockerUserFromParam(paramUser: string | undefined): Promise<string | undefined>;
}
