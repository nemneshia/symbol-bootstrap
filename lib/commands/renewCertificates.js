"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const command_1 = require("@oclif/command");
const symbol_sdk_1 = require("symbol-sdk");
const logger_1 = require("../logger");
const service_1 = require("../service");
class RenewCertificates extends command_1.Command {
    async run() {
        const { flags } = this.parse(RenewCertificates);
        service_1.CommandUtils.showBanner();
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        const password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        const target = flags.target;
        const configLoader = new service_1.ConfigLoader(logger);
        const oldPresetData = configLoader.loadExistingPresetData(target, password);
        const presetData = configLoader.createPresetData({
            workingDir: service_1.Constants.defaultWorkingDir,
            customPreset: flags.customPreset,
            password: password,
            oldPresetData,
        });
        const addresses = configLoader.loadExistingAddresses(target, password);
        const networkType = presetData.networkType;
        const accountResolver = new service_1.BootstrapAccountResolver(logger);
        const certificateService = new service_1.CertificateService(logger, accountResolver, {
            target,
            user: flags.user,
        });
        const certificateUpgraded = (await Promise.all((presetData.nodes || []).map((nodePreset, index) => {
            var _a;
            const nodeAccount = (_a = addresses.nodes) === null || _a === void 0 ? void 0 : _a[index];
            if (!nodeAccount) {
                throw new Error(`There is not node in addresses at index ${index}`);
            }
            function resolveAccount(configAccount, providedPrivateKey) {
                if (providedPrivateKey) {
                    const account = symbol_sdk_1.Account.createFromPrivateKey(providedPrivateKey, networkType);
                    if (account.address.plain() == configAccount.address) {
                        return account;
                    }
                }
                return configAccount;
            }
            const providedCertificates = {
                main: resolveAccount(nodeAccount.main, nodePreset.mainPrivateKey),
                transport: resolveAccount(nodeAccount.transport, nodePreset.transportPrivateKey),
            };
            return certificateService.run(presetData, nodePreset.name, providedCertificates, flags.force ? service_1.RenewMode.ALWAYS : service_1.RenewMode.WHEN_REQUIRED);
        }))).find((f) => f);
        if (certificateUpgraded) {
            logger.warn('');
            logger.warn('Bootstrap has created new SSL certificates. Review the logs!');
            logger.warn('');
        }
        else {
            logger.info('');
            logger.info('The SSL certificates are up-to-date. There is nothing to upgrade.');
            logger.info('');
        }
    }
}
exports.default = RenewCertificates;
RenewCertificates.description = `It renews the SSL certificates of the node regenerating the node.csr.pem files but reusing the current private keys.

The certificates are only regenerated when they are closed to expiration (30 days). If you want to renew anyway, use the --force param.

This command does not change the node private key (yet). This change would require a harvesters.dat migration and relinking the node key.

It's recommended to backup the target folder before running this operation!
`;
RenewCertificates.examples = [`$ symbol-bootstrap renewCertificates`];
RenewCertificates.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    password: service_1.CommandUtils.passwordFlag,
    noPassword: service_1.CommandUtils.noPasswordFlag,
    customPreset: command_1.flags.string({
        char: 'c',
        description: `This command uses the encrypted addresses.yml to resolve the main and transport private key. If the main and transport privates are only stored in the custom preset, you can provide them using this param. Otherwise, the command may ask for them when required.`,
        required: false,
    }),
    user: command_1.flags.string({
        char: 'u',
        description: `User used to run docker images when generating the certificates. "${service_1.Constants.CURRENT_USER}" means the current user.`,
        default: service_1.Constants.CURRENT_USER,
    }),
    force: command_1.flags.boolean({
        description: `Renew the certificates even though they are not close to expire.`,
        default: false,
    }),
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
