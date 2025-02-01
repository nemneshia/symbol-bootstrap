import { NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses } from '../model';
/**
 * The operation to migrate the data.
 */
export interface Migration {
    readonly description: string;
    migrate(from: any): any;
}
/**
 * Service used to migrate json objects like preset and addresses.
 */
export declare class MigrationService {
    private readonly logger;
    constructor(logger: Logger);
    migrateAddresses(addresses: any): Addresses;
    getAddressesMigration(networkType: NetworkType): Migration[];
    static migrate<T extends {
        version?: number;
    }>(logger: Logger, entityName: string, versioned: T, migrations?: Migration[]): T;
}
