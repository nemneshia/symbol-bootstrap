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
exports.RunService = void 0;
const fs_1 = require("fs");
const _ = require("lodash");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const symbol_openapi_typescript_fetch_client_1 = require("symbol-openapi-typescript-fetch-client");
const symbol_sdk_1 = require("symbol-sdk");
const AccountResolver_1 = require("./AccountResolver");
const AsyncUtils_1 = require("./AsyncUtils");
const CertificateService_1 = require("./CertificateService");
const ConfigLoader_1 = require("./ConfigLoader");
const Constants_1 = require("./Constants");
const FileSystemService_1 = require("./FileSystemService");
const OSUtils_1 = require("./OSUtils");
const PortService_1 = require("./PortService");
const RuntimeService_1 = require("./RuntimeService");
const Utils_1 = require("./Utils");
const YamlUtils_1 = require("./YamlUtils");
class RunService {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
        this.configLoader = new ConfigLoader_1.ConfigLoader(this.logger);
        this.fileSystemService = new FileSystemService_1.FileSystemService(this.logger);
        this.runtimeService = new RuntimeService_1.RuntimeService(this.logger);
    }
    async run() {
        if (this.params.resetData) {
            await this.resetData();
        }
        const basicArgs = ['up', '--remove-orphans'];
        if (this.params.detached) {
            basicArgs.push('--detach');
        }
        if (this.params.build) {
            basicArgs.push('--build');
        }
        if (this.params.args) {
            basicArgs.push(..._.flatMap(this.params.args, (s) => s.split(' ').map((internal) => internal.trim())));
        }
        await this.beforeRun(basicArgs, false);
        const promises = [];
        promises.push(this.basicRun(basicArgs));
        if (this.params.healthCheck) {
            await AsyncUtils_1.AsyncUtils.sleep(5000);
            promises.push(this.healthCheck());
        }
        await Promise.all(promises);
    }
    async healthCheck(pollIntervalMs = 10000) {
        const dockerFile = (0, path_1.join)(this.params.target, `docker`, `docker-compose.yml`);
        if (!(0, fs_1.existsSync)(dockerFile)) {
            this.logger.info(`Docker compose ${dockerFile} does not exist. Cannot check the status of the service.`);
            return;
        }
        if (!(await this.checkCertificates())) {
            throw new Error(`Certificates are about to expire. Check the logs!`);
        }
        const dockerCompose = YamlUtils_1.YamlUtils.fromYaml(await YamlUtils_1.YamlUtils.readTextFile(dockerFile));
        const services = Object.values(dockerCompose.services);
        const timeout = this.params.timeout || RunService.defaultParams.timeout || 0;
        const started = await AsyncUtils_1.AsyncUtils.poll(this.logger, () => this.runOneCheck(services), timeout, pollIntervalMs);
        if (!started) {
            throw new Error(`Network did NOT start!!!`);
        }
        else {
            this.logger.info('Network is running!');
        }
    }
    async checkCertificates() {
        const presetData = this.configLoader.loadExistingPresetData(this.params.target, false);
        const service = new CertificateService_1.CertificateService(this.logger, new AccountResolver_1.DefaultAccountResolver(), {
            target: this.params.target,
            user: Constants_1.Constants.CURRENT_USER,
        });
        const allServicesChecks = (presetData.nodes || []).map(async (nodePreset) => {
            const name = nodePreset.name;
            const certFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'cert');
            const willExpireReport = await service.willCertificateExpire(presetData.symbolServerImage, certFolder, CertificateService_1.CertificateService.NODE_CERTIFICATE_FILE_NAME, presetData.certificateExpirationWarningInDays);
            if (willExpireReport.willExpire) {
                this.logger.warn(`The ${CertificateService_1.CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire in less than ${presetData.certificateExpirationWarningInDays} days on ${willExpireReport.expirationDate}. You need to renew it.`);
            }
            else {
                this.logger.info(`The ${CertificateService_1.CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire on ${willExpireReport.expirationDate}. No need to renew it yet.`);
            }
            return !willExpireReport.willExpire;
        });
        return (await Promise.all(allServicesChecks)).every((t) => t);
    }
    async runOneCheck(services) {
        const runningContainers = (await this.runtimeService.exec('docker ps --format {{.Names}}')).stdout.split(`\n`);
        const allServicesChecks = services.map(async (service) => {
            if (runningContainers.indexOf(service.container_name) < 0) {
                this.logger.warn(`Container ${service.container_name} is NOT running YET.`);
                return false;
            }
            this.logger.info(`Container ${service.container_name} is running`);
            return (await Promise.all((service.ports || []).map(async (portBind) => {
                const ports = portBind.split(':');
                const externalPort = parseInt(ports[0]);
                const internalPort = ports.length > 1 ? parseInt(ports[1]) : externalPort;
                const portOpen = await PortService_1.PortService.isReachable(externalPort, 'localhost');
                if (portOpen) {
                    this.logger.info(`Container ${service.container_name} port ${externalPort} -> ${internalPort} is open`);
                }
                else {
                    this.logger.warn(`Container ${service.container_name} port ${externalPort} -> ${internalPort}  is NOT open YET.`);
                    return false;
                }
                if (service.container_name.indexOf('rest-gateway') > -1) {
                    const url = 'http://localhost:' + externalPort;
                    const repositoryFactory = new symbol_sdk_1.RepositoryFactoryHttp(url);
                    const nodeRepository = repositoryFactory.createNodeRepository();
                    const testUrl = `${url}/node/health`;
                    this.logger.info(`Testing ${testUrl}`);
                    try {
                        const healthStatus = await (0, rxjs_1.firstValueFrom)(nodeRepository.getNodeHealth());
                        if (healthStatus.apiNode === symbol_openapi_typescript_fetch_client_1.NodeStatusEnum.Down) {
                            this.logger.warn(`Rest ${testUrl} is NOT up and running YET: Api Node is still Down!`);
                            return false;
                        }
                        if (healthStatus.db === symbol_openapi_typescript_fetch_client_1.NodeStatusEnum.Down) {
                            this.logger.warn(`Rest ${testUrl} is NOT up and running YET: DB is still Down!`);
                            return false;
                        }
                        this.logger.info(`Rest ${testUrl} is up and running...`);
                        return true;
                    }
                    catch (e) {
                        this.logger.warn(`Rest ${testUrl} is NOT up and running YET: ${Utils_1.Utils.getMessage(e)}`);
                        return false;
                    }
                }
                return true;
            }))).every((t) => t);
        });
        return (await Promise.all(allServicesChecks)).every((t) => t);
    }
    async resetData() {
        this.logger.info('Resetting data');
        const target = this.params.target;
        const preset = this.configLoader.loadExistingPresetData(target, false);
        await Promise.all((preset.nodes || []).map(async (node) => {
            const componentConfigFolder = this.fileSystemService.getTargetNodesFolder(target, false, node.name);
            const dataFolder = (0, path_1.join)(componentConfigFolder, 'data');
            const logsFolder = (0, path_1.join)(componentConfigFolder, 'logs');
            this.fileSystemService.deleteFolder(dataFolder);
            this.fileSystemService.deleteFolder(logsFolder);
            await this.fileSystemService.mkdir(dataFolder);
            await this.fileSystemService.mkdir(logsFolder);
        }));
        (preset.gateways || []).forEach((node) => {
            this.fileSystemService.deleteFolder(this.fileSystemService.getTargetGatewayFolder(target, false, node.name, 'logs'));
        });
        this.fileSystemService.deleteFolder(this.fileSystemService.getTargetDatabasesFolder(target, false));
    }
    async stop() {
        const args = ['stop'];
        if (await this.beforeRun(args, true))
            await this.basicRun(args);
    }
    async beforeRun(extraArgs, ignoreIfNotFound) {
        const dockerFile = (0, path_1.join)(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        if (!(0, fs_1.existsSync)(dockerFile)) {
            if (ignoreIfNotFound) {
                this.logger.info(`Docker compose ${dockerFile} does not exist, ignoring: docker-compose ${args.join(' ')}`);
                return false;
            }
            else {
                throw new Error(`Docker compose ${dockerFile} does not exist. Cannot run: docker-compose ${args.join(' ')}`);
            }
        }
        //Creating folders to avoid being created using sudo. Is there a better way?
        const dockerCompose = await YamlUtils_1.YamlUtils.loadYaml(dockerFile, false);
        if (!ignoreIfNotFound && this.params.pullImages)
            await this.pullImages(dockerCompose);
        const volumenList = _.flatMap(Object.values(dockerCompose === null || dockerCompose === void 0 ? void 0 : dockerCompose.services), (s) => { var _a; return ((_a = s.volumes) === null || _a === void 0 ? void 0 : _a.map((v) => v.split(':')[0])) || []; }) || [];
        await Promise.all(volumenList.map(async (v) => {
            const volumenPath = (0, path_1.join)(this.params.target, `docker`, v);
            if (!(0, fs_1.existsSync)(volumenPath))
                await this.fileSystemService.mkdir(volumenPath);
            if (v.startsWith('../databases') && OSUtils_1.OSUtils.isRoot()) {
                this.logger.info(`Chmod 777 folder ${volumenPath}`);
                (0, fs_1.chmodSync)(volumenPath, '777');
            }
        }));
        return true;
    }
    async basicRun(extraArgs) {
        const dockerFile = (0, path_1.join)(this.params.target, `docker`, `docker-compose.yml`);
        const dockerComposeArgs = ['-f', dockerFile];
        const args = [...dockerComposeArgs, ...extraArgs];
        return this.runtimeService.spawn({ command: 'docker-compose', args: args, useLogger: false });
    }
    async pullImages(dockerCompose) {
        const images = _.uniq(Object.values(dockerCompose.services)
            .map((s) => s.image)
            .filter((s) => s)
            .map((s) => s));
        await Promise.all(images.map((image) => this.runtimeService.pullImage(image)));
    }
}
exports.RunService = RunService;
RunService.defaultParams = {
    target: Constants_1.Constants.defaultTargetFolder,
    timeout: 60000,
    pullImages: false,
    resetData: false,
};
