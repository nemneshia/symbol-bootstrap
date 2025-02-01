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
exports.ComposeService = void 0;
const fs_1 = require("fs");
const _ = require("lodash");
const path_1 = require("path");
const ConfigLoader_1 = require("./ConfigLoader");
const Constants_1 = require("./Constants");
const FileSystemService_1 = require("./FileSystemService");
const HandlebarsUtils_1 = require("./HandlebarsUtils");
const RemoteNodeService_1 = require("./RemoteNodeService");
const RuntimeService_1 = require("./RuntimeService");
const Utils_1 = require("./Utils");
const YamlUtils_1 = require("./YamlUtils");
const targetNodesFolder = Constants_1.Constants.targetNodesFolder;
const targetDatabasesFolder = Constants_1.Constants.targetDatabasesFolder;
const targetGatewaysFolder = Constants_1.Constants.targetGatewaysFolder;
const targetExplorersFolder = Constants_1.Constants.targetExplorersFolder;
class ComposeService {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
        this.configLoader = new ConfigLoader_1.ConfigLoader(logger);
        this.fileSystemService = new FileSystemService_1.FileSystemService(logger);
    }
    resolveDebugOptions(dockerComposeDebugMode, dockerComposeServiceDebugMode) {
        if (dockerComposeServiceDebugMode == false) {
            return {};
        }
        if (dockerComposeServiceDebugMode || dockerComposeDebugMode) {
            return ComposeService.DEBUG_SERVICE_PARAMS;
        }
        return {};
    }
    async run(passedPresetData, passedAddresses) {
        const presetData = passedPresetData !== null && passedPresetData !== void 0 ? passedPresetData : this.configLoader.loadExistingPresetData(this.params.target, this.params.password || false);
        const remoteNodeService = new RemoteNodeService_1.RemoteNodeService(this.logger, presetData, this.params.offline);
        const currentDir = process.cwd();
        const target = (0, path_1.join)(currentDir, this.params.target);
        const targetDocker = (0, path_1.join)(target, `docker`);
        if (this.params.upgrade) {
            this.fileSystemService.deleteFolder(targetDocker);
        }
        const dockerFile = (0, path_1.join)(targetDocker, 'docker-compose.yml');
        if ((0, fs_1.existsSync)(dockerFile)) {
            this.logger.info(dockerFile + ' already exist. Reusing. (run --upgrade to drop and upgrade)');
            return YamlUtils_1.YamlUtils.loadYaml(dockerFile, false);
        }
        await this.fileSystemService.mkdir(targetDocker);
        await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(presetData, (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'config', 'docker'), targetDocker);
        await this.fileSystemService.chmodRecursive((0, path_1.join)(targetDocker, 'mongo'), 0o666);
        const user = await new RuntimeService_1.RuntimeService(this.logger).resolveDockerUserFromParam(this.params.user);
        const vol = (hostFolder, imageFolder, readOnly) => {
            return `${hostFolder}:${imageFolder}:${readOnly ? 'ro' : 'rw'}`;
        };
        this.logger.info(`Creating docker-compose.yml from last used profile.`);
        const services = [];
        const resolvePorts = (portConfigurations) => {
            return portConfigurations
                .filter((c) => c.openPort)
                .map(({ openPort, internalPort }) => {
                if (openPort === true || openPort === 'true') {
                    return `${internalPort}:${internalPort}`;
                }
                return `${openPort}:${internalPort}`;
            });
        };
        const resolveHttpsProxyDomains = (fromDomain, toDomain) => {
            return `${fromDomain} -> ${toDomain}`;
        };
        const resolveService = async (servicePreset, rawService) => {
            const service = Object.assign({}, rawService);
            if (servicePreset.host || servicePreset.ipv4_address) {
                service.networks = { default: {} };
            }
            if (servicePreset.host) {
                service.hostname = servicePreset.host;
                service.networks.default.aliases = [servicePreset.host];
            }
            if (servicePreset.stopGracePeriod) {
                service.stop_grace_period = servicePreset.stopGracePeriod;
            }
            if (servicePreset.ipv4_address) {
                service.networks.default.ipv4_address = servicePreset.ipv4_address;
            }
            return _.merge({}, service, servicePreset.compose);
        };
        await Promise.all((presetData.databases || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            const databaseName = n.databaseName || presetData.databaseName;
            const databasePort = 27017;
            services.push(await resolveService(n, Object.assign({ user, environment: { MONGO_INITDB_DATABASE: databaseName }, container_name: n.name, image: presetData.mongoImage, command: `mongod --dbpath=/dbdata --bind_ip=${n.name} ${presetData.mongoComposeRunParam}`, stop_signal: 'SIGINT', working_dir: '/docker-entrypoint-initdb.d', ports: resolvePorts([{ internalPort: databasePort, openPort: n.openPort }]), volumes: [
                    vol(`./mongo`, `/docker-entrypoint-initdb.d`, true),
                    vol(`../${targetDatabasesFolder}/${n.name}`, '/dbdata', false),
                ] }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode))));
        }));
        const nodeWorkingDirectory = '/symbol-workdir';
        const nodeCommandsDirectory = '/symbol-commands';
        const restart = presetData.dockerComposeServiceRestart;
        await Promise.all((presetData.nodes || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            const debugFlag = 'DEBUG';
            const serverDebugMode = presetData.dockerComposeDebugMode || n.dockerComposeDebugMode ? debugFlag : 'NORMAL';
            const brokerDebugMode = presetData.dockerComposeDebugMode || n.brokerDockerComposeDebugMode ? debugFlag : 'NORMAL';
            const serverCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${presetData.dataDirectory} server broker ${n.name} ${serverDebugMode} ${!!n.brokerName}`;
            const brokerCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${presetData.dataDirectory} broker server ${n.brokerName || 'broker'} ${brokerDebugMode}`;
            const portConfigurations = [{ internalPort: 7900, openPort: n.openPort }];
            const serverDependsOn = [];
            const brokerDependsOn = [];
            if (n.databaseHost) {
                serverDependsOn.push(n.databaseHost);
                brokerDependsOn.push(n.databaseHost);
            }
            if (n.brokerName) {
                serverDependsOn.push(n.brokerName);
            }
            const volumes = [
                vol(`../${targetNodesFolder}/${n.name}`, nodeWorkingDirectory, false),
                vol(`./server`, nodeCommandsDirectory, true),
            ];
            const nodeService = await resolveService({
                ipv4_address: n.ipv4_address,
                openPort: n.openPort,
                excludeDockerService: n.excludeDockerService,
                host: n.host,
                compose: n.compose,
                stopGracePeriod: n.nodeStopGracePeriod || presetData.nodeStopGracePeriod,
            }, Object.assign({ user: serverDebugMode === debugFlag ? undefined : user, container_name: n.name, image: presetData.symbolServerImage, command: serverCommand, stop_signal: 'SIGINT', working_dir: nodeWorkingDirectory, restart: restart, ports: resolvePorts(portConfigurations), volumes: volumes, depends_on: serverDependsOn }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode)));
            services.push(nodeService);
            if (n.brokerName) {
                services.push(await resolveService({
                    ipv4_address: n.brokerIpv4_address,
                    openPort: n.brokerOpenPort,
                    excludeDockerService: n.brokerExcludeDockerService,
                    host: n.brokerHost,
                    compose: n.brokerCompose,
                    stopGracePeriod: n.brokerStopGracePeriod || presetData.brokerStopGracePeriod,
                }, Object.assign({ user: brokerDebugMode === debugFlag ? undefined : user, container_name: n.brokerName, image: nodeService.image, working_dir: nodeWorkingDirectory, command: brokerCommand, ports: resolvePorts([{ internalPort: 7902, openPort: n.brokerOpenPort }]), stop_signal: 'SIGINT', restart: restart, volumes: nodeService.volumes, depends_on: brokerDependsOn }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.brokerDockerComposeDebugMode))));
            }
        }));
        const restInternalPort = 3000; // Move to shared?
        await Promise.all((presetData.gateways || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            const volumes = [vol(`../${targetGatewaysFolder}/${n.name}`, nodeWorkingDirectory, false)];
            services.push(await resolveService(n, Object.assign({ container_name: n.name, user, environment: { npm_config_cache: nodeWorkingDirectory }, image: presetData.symbolRestImage, command: 'npm start --prefix /app /symbol-workdir/rest.json', stop_signal: 'SIGINT', working_dir: nodeWorkingDirectory, ports: resolvePorts([{ internalPort: restInternalPort, openPort: n.openPort }]), restart: restart, volumes: volumes, depends_on: [n.databaseHost] }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode))));
        }));
        await Promise.all((presetData.httpsProxies || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            var _a, _b, _c;
            const internalPort = 443;
            const resolveHost = () => {
                var _a, _b;
                const host = n.host || ((_b = (_a = presetData.nodes) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.host);
                if (!host) {
                    throw new Error(`HTTPS Proxy ${n.name} is invalid, 'host' property could not be resolved. It must be set to a valid DNS record.`);
                }
                return host;
            };
            const domains = n.domains ||
                ((_a = presetData.gateways) === null || _a === void 0 ? void 0 : _a.map((g) => resolveHttpsProxyDomains(resolveHost(), `http://${g.name}:${restInternalPort}`))[0]);
            if (!domains) {
                throw new Error(`HTTPS Proxy ${n.name} is invalid, 'domains' property could not be resolved!`);
            }
            const restDependency = (_c = (_b = presetData.gateways) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.name;
            services.push(await resolveService(n, Object.assign({ container_name: n.name, image: presetData.httpsPortalImage, stop_signal: 'SIGINT', ports: resolvePorts([
                    { internalPort: 80, openPort: true },
                    { internalPort: internalPort, openPort: n.openPort },
                ]), environment: {
                    DOMAINS: domains,
                    WEBSOCKET: n.webSocket,
                    STAGE: n.stage,
                    SERVER_NAMES_HASH_BUCKET_SIZE: n.serverNamesHashBucketSize,
                }, restart: restart, depends_on: restDependency ? [restDependency] : [] }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode))));
        }));
        await Promise.all((presetData.explorers || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            const volumes = [
                vol(`../${targetExplorersFolder}/${n.name}`, nodeWorkingDirectory, true),
                vol(`./explorer`, nodeCommandsDirectory, true),
            ];
            const entrypoint = `ash -c "/bin/ash ${nodeCommandsDirectory}/run.sh ${n.name}"`;
            services.push(await resolveService(n, Object.assign({ container_name: n.name, image: presetData.symbolExplorerImage, entrypoint: entrypoint, stop_signal: 'SIGINT', working_dir: nodeWorkingDirectory, ports: resolvePorts([{ internalPort: 4000, openPort: n.openPort }]), restart: restart, volumes: volumes }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode))));
        }));
        await Promise.all((presetData.faucets || [])
            .filter((d) => !d.excludeDockerService)
            .map(async (n) => {
            const mosaicPreset = presetData.nemesis.mosaics[0];
            const fullName = `${presetData.baseNamespace}.${mosaicPreset.name}`;
            const { defaultNode } = await remoteNodeService.resolveRestUrlsForServices();
            services.push(await resolveService(n, Object.assign({ container_name: n.name, image: presetData.symbolFaucetImage, stop_signal: 'SIGINT', environment: {
                    DEFAULT_NODE: defaultNode,
                    DEFAULT_NODE_CLIENT: defaultNode,
                    NATIVE_CURRENCY_NAME: fullName,
                    FAUCET_PRIVATE_KEY: this.getMainAccountPrivateKey(passedAddresses) || '',
                    NATIVE_CURRENCY_ID: HandlebarsUtils_1.HandlebarsUtils.toSimpleHex(presetData.currencyMosaicId || ''),
                }, restart: restart, ports: resolvePorts([{ internalPort: 4000, openPort: n.openPort }]), depends_on: [n.gateway] }, this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode))));
        }));
        const validServices = services.filter((s) => s).map((s) => s);
        const servicesMap = _.keyBy(validServices, 'container_name');
        let dockerCompose = {
            version: presetData.dockerComposeVersion,
            services: servicesMap,
        };
        if (presetData.subnet)
            dockerCompose.networks = {
                default: {
                    ipam: {
                        config: [
                            {
                                subnet: presetData.subnet,
                            },
                        ],
                    },
                },
            };
        dockerCompose = Utils_1.Utils.pruneEmpty(_.merge({}, dockerCompose, presetData.compose));
        await YamlUtils_1.YamlUtils.writeYaml(dockerFile, dockerCompose, undefined);
        this.logger.info(`The docker-compose.yml file created ${dockerFile}`);
        return dockerCompose;
    }
    getMainAccountPrivateKey(passedAddresses) {
        var _a, _b;
        const addresses = passedAddresses !== null && passedAddresses !== void 0 ? passedAddresses : this.configLoader.loadExistingAddressesIfPreset(this.params.target, this.params.password);
        return (_b = (_a = addresses === null || addresses === void 0 ? void 0 : addresses.mosaics) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.accounts[0].privateKey;
    }
}
exports.ComposeService = ComposeService;
ComposeService.defaultParams = {
    target: Constants_1.Constants.defaultTargetFolder,
    user: Constants_1.Constants.CURRENT_USER,
    workingDir: Constants_1.Constants.defaultWorkingDir,
    upgrade: false,
    offline: false,
};
ComposeService.DEBUG_SERVICE_PARAMS = {
    security_opt: ['seccomp:unconfined'],
    cap_add: ['ALL'],
    privileged: true,
};
