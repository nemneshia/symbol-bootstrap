import { Logger } from '../logger/index.js';
import { Addresses } from '../model/index.js';
import { ICryptoPort, NetworkType, SymbolCryptoAdapter } from '../sdk/index.js';
import { ConfigurationUtils } from '../utils/ConfigurationUtils.js';
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
export class MigrationService {
  constructor(
    private readonly logger: Logger,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
  ) {}
  public migrateAddresses(addresses: any): Addresses {
    const addressesFileName = 'addresses.yml';
    const networkType = addresses.networkType;
    if (!networkType) {
      throw new Error(`networkType must exist on current ${addressesFileName}`);
    }
    const migrations = this.getAddressesMigration(networkType);
    return MigrationService.migrate(this.logger, addressesFileName, addresses, migrations);
  }

  public getAddressesMigration(networkType: NetworkType): Migration[] {
    return [
      {
        description: 'Key names migration',

        migrate: (from: any): any => {
          (from.nodes || []).forEach((nodeAddresses: any): any => {
            if (nodeAddresses.signing) {
              nodeAddresses.main = nodeAddresses.signing;
            } else {
              if (nodeAddresses.ssl) {
                nodeAddresses.main = ConfigurationUtils.toConfigAccount(
                  this.cryptoPort.createAccountFromPrivateKey(nodeAddresses.ssl.privateKey, networkType),
                );
              }
            }
            nodeAddresses.transport = ConfigurationUtils.toConfigAccountFomKeys(
              networkType,
              nodeAddresses?.node?.publicKey,
              nodeAddresses?.node?.privateKey,
              this.cryptoPort,
            );
            if (!nodeAddresses.transport) {
              nodeAddresses.transport = ConfigurationUtils.toConfigAccount(this.cryptoPort.generateAccount(networkType));
            }
            delete nodeAddresses.node;
            delete nodeAddresses.signing;
            delete nodeAddresses.ssl;
          });
          return from;
        },
      },
    ];
  }

  public static migrate<T extends { version?: number }>(logger: Logger, entityName: string, versioned: T, migrations: Migration[] = []): T {
    if (!versioned) {
      return versioned;
    }
    const currentVersion = migrations.length + 1;
    versioned.version = versioned.version || 1;

    if (versioned.version == currentVersion) {
      return versioned;
    }
    logger.info(`Migrating object ${entityName} from version ${versioned.version} to version ${currentVersion}`);
    if (versioned.version > currentVersion) {
      throw new Error(`Current data version is ${versioned.version} but higher version is ${currentVersion}`);
    }
    const migratedVersioned = migrations.slice(versioned.version - 1).reduce((toMigrateData, migration) => {
      if (toMigrateData === undefined) {
        logger.info(`data to migrate is undefined, ignoring migration ${migration.description}`);
        return undefined;
      }
      logger.info(`Applying migration ${migration.description}`);
      return migration.migrate(toMigrateData);
    }, versioned);
    migratedVersioned.version = currentVersion;
    logger.info(`Object ${entityName} migrated to version ${currentVersion}`);
    return migratedVersioned;
  }
}
