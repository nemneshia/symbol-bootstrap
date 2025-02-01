import { Logger } from '../logger';
import { ConfigPreset } from '../model';
import { ConfigParams } from './ConfigService';
declare type NemgenParams = ConfigParams;
export declare class NemgenService {
    private readonly logger;
    protected readonly params: NemgenParams;
    private readonly runtimeService;
    private readonly fileSystemService;
    constructor(logger: Logger, params: NemgenParams);
    run(presetData: ConfigPreset): Promise<void>;
}
export {};
