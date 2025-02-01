"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const symbol_sdk_1 = require("symbol-sdk");
const ConfigurationUtils_1 = require("./ConfigurationUtils");
/**
 * Service used to migrate json objects like preset and addresses.
 */
class MigrationService {
    constructor(logger) {
        this.logger = logger;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    migrateAddresses(addresses) {
        const addressesFileName = 'addresses.yml';
        const networkType = addresses.networkType;
        if (!networkType) {
            throw new Error(`networkType must exist on current ${addressesFileName}`);
        }
        const migrations = this.getAddressesMigration(networkType);
        return MigrationService.migrate(this.logger, addressesFileName, addresses, migrations);
    }
    getAddressesMigration(networkType) {
        return [
            {
                description: 'Key names migration',
                migrate(from) {
                    (from.nodes || []).forEach((nodeAddresses) => {
                        var _a, _b;
                        if (nodeAddresses.signing) {
                            nodeAddresses.main = nodeAddresses.signing;
                        }
                        else {
                            if (nodeAddresses.ssl) {
                                nodeAddresses.main = ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(symbol_sdk_1.Account.createFromPrivateKey(nodeAddresses.ssl.privateKey, networkType));
                            }
                        }
                        nodeAddresses.transport = ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, (_a = nodeAddresses === null || nodeAddresses === void 0 ? void 0 : nodeAddresses.node) === null || _a === void 0 ? void 0 : _a.publicKey, (_b = nodeAddresses === null || nodeAddresses === void 0 ? void 0 : nodeAddresses.node) === null || _b === void 0 ? void 0 : _b.privateKey);
                        if (!nodeAddresses.transport) {
                            nodeAddresses.transport = ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(symbol_sdk_1.Account.generateNewAccount(networkType));
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
    static migrate(logger, entityName, versioned, migrations = []) {
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
exports.MigrationService = MigrationService;
