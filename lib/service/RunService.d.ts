import { Logger } from '../logger';
/**
 * params necessary to run the docker-compose network.
 */
export declare type RunParams = {
    detached?: boolean;
    healthCheck?: boolean;
    build?: boolean;
    pullImages?: boolean;
    timeout?: number;
    args?: string[];
    resetData?: boolean;
    target: string;
};
export declare class RunService {
    private readonly logger;
    protected readonly params: RunParams;
    static readonly defaultParams: RunParams;
    private readonly configLoader;
    private readonly fileSystemService;
    private readonly runtimeService;
    constructor(logger: Logger, params: RunParams);
    run(): Promise<void>;
    healthCheck(pollIntervalMs?: number): Promise<void>;
    private checkCertificates;
    private runOneCheck;
    resetData(): Promise<void>;
    stop(): Promise<void>;
    private beforeRun;
    private basicRun;
    private pullImages;
}
