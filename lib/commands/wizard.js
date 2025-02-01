"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wizard = exports.assemblies = exports.CustomNetwork = exports.HttpsOption = exports.assembliesDescriptions = void 0;
const command_1 = require("@oclif/command");
const fs_1 = require("fs");
const inquirer_1 = require("inquirer");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const logger_1 = require("../logger");
const model_1 = require("../model");
const service_1 = require("../service");
exports.assembliesDescriptions = {
    [service_1.Assembly.dual]: 'Dual Node',
    [service_1.Assembly.peer]: 'Peer Node',
    [service_1.Assembly.api]: 'Api Node',
    [service_1.Assembly.demo]: 'Demo Node. A dual node that includes a Faucet and Explorer.',
    [service_1.Assembly.multinode]: 'Multinode Node. A docker compose that includes one api, one rest and two peers.',
    [service_1.Assembly.services]: 'Services. A docker compose with just Faucet and Explorer.',
};
var HttpsOption;
(function (HttpsOption) {
    HttpsOption["Native"] = "Native";
    HttpsOption["Automatic"] = "Automatic";
    HttpsOption["None"] = "None";
})(HttpsOption = exports.HttpsOption || (exports.HttpsOption = {}));
var CustomNetwork;
(function (CustomNetwork) {
    CustomNetwork["custom"] = "custom";
})(CustomNetwork = exports.CustomNetwork || (exports.CustomNetwork = {}));
exports.assemblies = {
    [service_1.Preset.mainnet]: [service_1.Assembly.dual, service_1.Assembly.peer, service_1.Assembly.api],
    [service_1.Preset.testnet]: [service_1.Assembly.dual, service_1.Assembly.peer, service_1.Assembly.api, service_1.Assembly.demo],
    [service_1.Preset.bootstrap]: [service_1.Assembly.multinode, service_1.Assembly.dual, service_1.Assembly.peer, service_1.Assembly.api, service_1.Assembly.demo],
    [CustomNetwork.custom]: [service_1.Assembly.dual, service_1.Assembly.peer, service_1.Assembly.api],
};
class WizardCommand extends command_1.Command {
    static getNetworkIdFlag() {
        return command_1.flags.string({
            description: 'The node or network you want to create.',
            options: [...Object.values(service_1.Preset), ...Object.values(CustomNetwork)],
        });
    }
    static getCustomPresetFile() {
        return command_1.flags.string({ char: 'c', description: 'The custom preset to be created.', default: 'custom-preset.yml' });
    }
    async run() {
        const flags = this.parse(WizardCommand).flags;
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        return new Wizard(logger).execute(Object.assign(Object.assign({}, flags), { workingDir: service_1.Constants.defaultWorkingDir }));
    }
}
exports.default = WizardCommand;
WizardCommand.description = 'An utility command that will help you configuring node!';
WizardCommand.examples = [`$ symbol-bootstrap wizard`];
WizardCommand.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    password: service_1.CommandUtils.passwordFlag,
    noPassword: service_1.CommandUtils.noPasswordFlag,
    network: WizardCommand.getNetworkIdFlag(),
    customPreset: WizardCommand.getCustomPresetFile(),
    ready: command_1.flags.boolean({
        description: 'If --ready is provided, the command will not ask offline confirmation.',
    }),
    logger: service_1.CommandUtils.getLoggerFlag(logger_1.LogType.Console),
};
class Wizard {
    constructor(logger) {
        this.logger = logger;
    }
    async execute(flags) {
        service_1.CommandUtils.showBanner();
        this.logger.info('Welcome to the Symbol Bootstrap wizard! This command will:');
        this.logger.info(' - Guide you through the configuration process.');
        this.logger.info(' - Import or generate private keys.');
        this.logger.info(` - Create a custom preset and show you the way to launch your node!`);
        this.logger.info('');
        const target = flags.target;
        const customPresetFile = flags.customPreset;
        if ((0, fs_1.existsSync)(customPresetFile)) {
            throw new Error(`${customPresetFile} already exist!!! You should move the file somewhere else before overwriting it!`);
        }
        if ((0, fs_1.existsSync)(target)) {
            throw new Error('There is currently a ./target folder here!!!! Have you executed bootstrap already? You should move the folder somewhere else before overwriting it!');
        }
        const network = await this.resolveNetwork(flags.network);
        const preset = await this.resolvePreset(network, flags.workingDir);
        const assembly = await this.resolveAssembly(network);
        if (network == service_1.Preset.bootstrap) {
            this.logger.info('For a private network, just run: ');
            this.logger.info('');
            this.logger.info(`$ symbol-bootstrap start -p ${preset} -a ${assembly}`);
            return;
        }
        if (!flags.skipPull) {
            const service = new service_1.BootstrapService(this.logger);
            const runtimeService = new service_1.RuntimeService(this.logger);
            this.logger.info('\nPulling catapult tools image before asking to go offline...\n');
            service_1.ConfigLoader.presetInfoLogged = true;
            await runtimeService.pullImage(service.resolveConfigPreset(Object.assign(Object.assign({}, service_1.ConfigService.defaultParams), { preset: preset, assembly: assembly, target: target })).symbolServerImage);
        }
        this.logger.info('');
        this.logger.info('');
        if (!flags.ready &&
            !(await (0, inquirer_1.prompt)([
                {
                    name: 'offlineNow',
                    message: `Symbol Bootstrap is about to start working with sensitive information (private keys) so it is highly recommended that you disconnect from the network before continuing. Say YES if you are offline or if you don't care.`,
                    type: 'confirm',
                    default: true,
                },
            ])).offlineNow) {
            this.logger.info('Come back when you are offline...');
            return;
        }
        this.logger.info('');
        this.logger.info('Symbol bootstrap needs to provide the node with a number of key pairs (Read more at https://docs.symbolplatform.com/concepts/cryptography.html#symbol-keys).');
        this.logger.info(`If you don't know what a key is used for, let Symbol Bootstrap generate a new one for you.`);
        const password = await service_1.CommandUtils.resolvePassword(this.logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, false);
        const networkType = network === service_1.Preset.mainnet ? symbol_sdk_1.NetworkType.MAIN_NET : symbol_sdk_1.NetworkType.TEST_NET;
        const accounts = await this.resolveAllAccounts(networkType);
        this.logger.info('');
        this.logger.info(`These are your node's accounts:`);
        this.logAccount(accounts.main, service_1.KeyName.Main, false);
        this.logAccount(accounts.vrf, service_1.KeyName.VRF, false);
        this.logAccount(accounts.remote, service_1.KeyName.Remote, false);
        this.logAccount(accounts.transport, service_1.KeyName.Transport, false);
        this.logger.info('');
        this.logger.info('');
        const httpsOption = await this.resolveHttpsOptions();
        const symbolHostNameRequired = httpsOption !== HttpsOption.None;
        const host = await this.resolveHost(`Enter the public domain name(eg. node-01.mysymbolnodes.com) that's pointing to your outbound host IP ${symbolHostNameRequired ? 'This value is required when you are running on HTTPS!' : ''}`, symbolHostNameRequired);
        const resolveHttpsCustomPreset = async () => {
            if (httpsOption === HttpsOption.Native) {
                const restSSLKeyBase64 = await this.resolveRestSSLKeyAsBase64();
                const restSSLCertificateBase64 = await this.resolveRestSSLCertAsBase64();
                return {
                    gateways: [
                        {
                            restProtocol: 'HTTPS',
                            openPort: 3001,
                            restSSLKeyBase64,
                            restSSLCertificateBase64,
                        },
                    ],
                };
            }
            else if (httpsOption === HttpsOption.Automatic) {
                return {
                    httpsProxies: [
                        {
                            excludeDockerService: false,
                        },
                    ],
                };
            }
            else {
                // HttpsOption.None
                this.logger.info(`Warning! You've chosen to proceed with http, which is less secure in comparison to https.`);
                return {};
            }
        };
        const httpsCustomPreset = await resolveHttpsCustomPreset();
        const friendlyName = await this.resolveFriendlyName(host || accounts.main.publicKey.substr(0, 7));
        const privateKeySecurityMode = await this.resolvePrivateKeySecurityMode();
        const voting = await this.isVoting();
        const presetContent = Object.assign({ assembly: assembly, preset: preset, privateKeySecurityMode: privateKeySecurityMode, nodes: [
                {
                    host: host,
                    voting: voting,
                    friendlyName: friendlyName,
                    mainPrivateKey: accounts.main.privateKey,
                    vrfPrivateKey: accounts.vrf.privateKey,
                    remotePrivateKey: accounts.remote.privateKey,
                    transportPrivateKey: accounts.transport.privateKey,
                },
            ] }, httpsCustomPreset);
        const defaultParams = service_1.ConfigService.defaultParams;
        await service_1.YamlUtils.writeYaml(customPresetFile, presetContent, password);
        this.logger.info('');
        this.logger.info('');
        this.logger.info(`The Symbol Bootstrap preset file '${customPresetFile}' has been created!!!. Keep this safe!`);
        this.logger.info('');
        this.logger.info(`To decrypt the node's private key, run: `);
        this.logger.info('');
        this.logger.info(`$ symbol-bootstrap decrypt --source ${customPresetFile} --destination plain-custom-preset.yml`);
        this.logger.info('');
        this.logger.info('Remember to delete the plain-custom-preset.yml file after used!!!');
        this.logger.info(`You can edit this file to further customize it. Read more https://github.com/symbol/symbol-bootstrap/blob/main/docs/presetGuides.md`);
        this.logger.info('');
        this.logger.info(`Once you have finished the custom preset customization, You can use the 'start' to run the node in this machine:`);
        this.logger.info('');
        const targetParam = target !== defaultParams.target ? `-t ${target}` : '';
        this.logger.info(`$ symbol-bootstrap start -c ${customPresetFile} ${targetParam}`);
        this.logger.info('');
        this.logger.info(`Alternatively, to create a zip file that can be deployed in your node machine you can use the 'pack' command:`);
        this.logger.info('');
        this.logger.info(`$ symbol-bootstrap pack -c ${customPresetFile} ${targetParam}`);
        this.logger.info('');
        this.logger.info(`Once the target folder is created, Bootstrap will use the protected and encrypted addresses.yml, and preset.yml in inside the target folder.`);
        this.logger.info('To upgrade your node version or configuration, use the --upgrade parameter in config, compose, start and/or pack. Remember to backup the node`s target folder!');
        this.logger.info('Hint: You can change the configuration of an already created node by proving a new custom preset. This is an experimental feature, backup the target folder before!');
        this.logger.info('');
        this.logger.info('To complete the registration, you need to link your keys (online):');
        this.logger.info('');
        this.logger.info(`$ symbol-bootstrap link --useKnownRestGateways -c ${customPresetFile}`);
        this.logger.info('');
    }
    logAccount(account, keyName, showPrivateKeys) {
        if (account === undefined) {
            return account;
        }
        const privateKeyText = showPrivateKeys && account instanceof symbol_sdk_1.Account ? `\n\tPrivate Key: ${account.privateKey}` : '';
        this.logger.info(` - ${keyName}:\n\tAddress:     ${account.address.plain()}\n\tPublic Key:  ${account.publicKey}${privateKeyText}`);
        return account;
    }
    async resolveAllAccounts(networkType) {
        this.logger.info('');
        return {
            seeded: true,
            main: await this.resolveAccountFromSelection(networkType, service_1.KeyName.Main, 'It holds the tokens required to give the node its importance.'),
            transport: await this.resolveAccountFromSelection(networkType, service_1.KeyName.Transport, 'It is used by nodes for secure transport over TLS.'),
            vrf: await this.resolveAccountFromSelection(networkType, service_1.KeyName.VRF, 'It is required for harvesting.'),
            remote: await this.resolveAccountFromSelection(networkType, service_1.KeyName.Remote, 'It is used to harvest and collect the rewards on behalf of the main account in remote harvesting.'),
        };
    }
    async resolveAccountFromSelection(networkType, keyName, keyDescription) {
        this.logger.info(`${keyName} Key Pair: ${keyDescription}`);
        while (true) {
            const keyCreationChoices = [];
            keyCreationChoices.push({ name: 'Generating a new account', value: 'generate' });
            keyCreationChoices.push({ name: 'Entering a private key', value: 'manual' });
            const { keyCreationMode } = await (0, inquirer_1.prompt)([
                {
                    name: 'keyCreationMode',
                    message: `How do you want to create the ${keyName} account:`,
                    type: 'list',
                    default: keyCreationChoices[0].name,
                    choices: keyCreationChoices,
                },
            ]);
            const log = (account, message) => {
                this.logger.info('');
                this.logger.info(`Using account ${account.address.plain()} for ${keyName} key. ${message}`);
                this.logger.info('');
                return account;
            };
            if (keyCreationMode == 'generate') {
                return log(this.generateAccount(networkType), 'It will be stored in your custom preset. Keep file safe!');
            }
            // manual
            const account = await this.resolveAccount(networkType, keyName);
            if (account) {
                return log(account, 'It will be stored in your custom preset. You can recreate the account by providing the private key again!');
            }
        }
    }
    generateAccount(networkType) {
        return symbol_sdk_1.Account.generateNewAccount(networkType);
    }
    async resolveAccount(networkType, keyName) {
        while (true) {
            const { privateKey } = await (0, inquirer_1.prompt)([
                {
                    name: 'privateKey',
                    message: `Enter the 64 HEX private key of the ${keyName} account (or press enter to select the option again).`,
                    type: 'password',
                    mask: '*',
                    validate: (value) => {
                        if (!value) {
                            return true;
                        }
                        return service_1.CommandUtils.isValidPrivateKey(value);
                    },
                },
            ]);
            if (!privateKey) {
                return undefined;
            }
            else {
                const enteredAccount = symbol_sdk_1.Account.createFromPrivateKey(privateKey, networkType);
                const { ok } = await (0, inquirer_1.prompt)([
                    {
                        name: 'ok',
                        message: `Is this the expected address ${enteredAccount.address.plain()} to used as ${keyName} account? `,
                        type: 'confirm',
                        default: false,
                    },
                ]);
                if (ok) {
                    return enteredAccount;
                }
            }
        }
    }
    async resolveNetwork(providedNetwork) {
        if (!providedNetwork) {
            this.logger.info('Select type node or network you want to run:\n');
            const responses = await (0, inquirer_1.prompt)([
                {
                    name: 'network',
                    message: 'Select a network:',
                    type: 'list',
                    default: service_1.Preset.mainnet,
                    choices: [
                        { name: 'Mainnet Node', value: service_1.Preset.mainnet },
                        { name: 'Testnet Node', value: service_1.Preset.testnet },
                        { name: 'Bootstrap Local Network', value: service_1.Preset.bootstrap },
                        {
                            name: `Custom Network Node ('custom-network-preset.yml' file and 'nemesis-seed' folder are required)`,
                            value: CustomNetwork.custom,
                        },
                    ],
                },
            ]);
            return responses.network;
        }
        return providedNetwork;
    }
    async resolvePreset(network, workingDir) {
        if (network === CustomNetwork.custom) {
            this.logger.info(`Enter the network preset you want to join. If you don't know have the network preset, ask the network admin for the file and nemesis seed.\n`);
            const responses = await (0, inquirer_1.prompt)([
                {
                    name: 'networkPresetFile',
                    message: 'Enter the network a network:',
                    type: 'input',
                    validate(input) {
                        const fileLocation = (0, path_1.join)(workingDir, input);
                        if (!service_1.YamlUtils.isYmlFile(fileLocation)) {
                            return `${fileLocation} is not a yaml file`;
                        }
                        if (!(0, fs_1.existsSync)(fileLocation)) {
                            return `${fileLocation} doesn't exist`;
                        }
                        return true;
                    },
                    default: 'custom-network-preset.yml',
                },
            ]);
            return responses.networkPresetFile;
        }
        return network;
    }
    async resolvePrivateKeySecurityMode() {
        const { mode } = await (0, inquirer_1.prompt)([
            {
                name: 'mode',
                message: 'Select the type of security you want to use:',
                type: 'list',
                default: model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
                choices: [
                    {
                        name: 'PROMPT_MAIN: Bootstrap may ask for the Main private key when doing certificates upgrades. Other keys are encrypted.',
                        value: model_1.PrivateKeySecurityMode.PROMPT_MAIN,
                    },
                    {
                        name: 'PROMPT_MAIN_TRANSPORT: Bootstrap may ask for the Main and Transport private keys when regenerating certificates. Other keys are encrypted. Recommended for most nodes',
                        value: model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
                    },
                    { name: 'ENCRYPT: All keys are encrypted, only password would be asked', value: model_1.PrivateKeySecurityMode.ENCRYPT },
                ],
            },
        ]);
        return mode;
    }
    async resolveAssembly(network) {
        this.logger.info('Select the assembly to be created:\n');
        const responses = await (0, inquirer_1.prompt)([
            {
                name: 'assembly',
                message: 'Select an assembly:',
                type: 'list',
                default: exports.assemblies[network][0],
                choices: exports.assemblies[network].map((value) => ({
                    value: value,
                    name: exports.assembliesDescriptions[value],
                })),
            },
        ]);
        return responses.assembly;
    }
    async isVoting() {
        this.logger.info('Select whether your Symbol node should be a Voting node. Note: A Voting node requires the main account to hold at least 3 million XYMs. ');
        this.logger.info('If your node does not have enough XYMs its Voting key may not be included. ');
        const { voting } = await (0, inquirer_1.prompt)([
            {
                name: 'voting',
                message: 'Are you creating a Voting node?',
                type: 'confirm',
                default: false,
            },
        ]);
        return voting;
    }
    async resolveHost(message, required) {
        const { host } = await (0, inquirer_1.prompt)([
            {
                name: 'host',
                message: message,
                type: 'input',
                validate: (value) => {
                    if (!required && !value) {
                        return true;
                    }
                    return this.isValidHost(value);
                },
            },
        ]);
        return host || undefined;
    }
    async resolveRestSSLKeyAsBase64() {
        return this.resolveFileContent('base64', 'Enter your SSL key file path:', 'Invalid path, cannot find SSL key file!');
    }
    async resolveRestSSLCertAsBase64() {
        return this.resolveFileContent('base64', 'Enter your SSL Certificate file path:', 'Invalid path, cannot find SSL certificate file!');
    }
    async resolveFileContent(encoding, message, notFoundMessage) {
        const { value } = await (0, inquirer_1.prompt)([
            {
                name: 'value',
                message: message,
                type: 'input',
                validate: (value) => {
                    if (!(0, fs_1.existsSync)(value)) {
                        return notFoundMessage;
                    }
                    return true;
                },
            },
        ]);
        return (0, fs_1.readFileSync)(value, encoding);
    }
    // TODO Refactor this
    isValidHost(input) {
        if (input.trim() == '') {
            return 'Host is required.';
        }
        if (input.length > 50) {
            return `Input (${input.length}) is larger than 50`;
        }
        const valid = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+(?:[A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(input);
        return valid ? true : `It's not a valid IP or hostname`;
    }
    isValidFriendlyName(input) {
        if (input.trim() == '') {
            return 'Friendly name is required.';
        }
        if (input.length > 30) {
            return `Input (${input.length}) is larger than 30`;
        }
        return true;
    }
    async resolveFriendlyName(defaultFriendlyName) {
        const { friendlyName } = await (0, inquirer_1.prompt)([
            {
                name: 'friendlyName',
                message: `Enter the friendly name of your node.`,
                type: 'input',
                default: defaultFriendlyName,
                validate: this.isValidFriendlyName,
            },
        ]);
        return friendlyName;
    }
    async resolveHttpsOptions() {
        // TODO work on these messages, should be concise and clearer
        this.logger.info('Your REST Gateway should be running on HTTPS (which is a secure protocol) so that it can be recognized by the Symbol Explorer.');
        const { value } = await (0, inquirer_1.prompt)([
            {
                name: 'value',
                message: 'Select your HTTPS setup method:',
                type: 'list',
                default: HttpsOption.Native,
                choices: [
                    { name: 'Native support, I have the SSL certificate and key.', value: HttpsOption.Native },
                    {
                        name: `Automatic, all of your keys and certs will be generated/renewed automatically, using letsencyrpt.`,
                        value: HttpsOption.Automatic,
                    },
                    { name: 'None', value: HttpsOption.None },
                ],
            },
        ]);
        return value;
    }
}
exports.Wizard = Wizard;
