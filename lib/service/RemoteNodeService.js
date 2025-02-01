"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteNodeService = void 0;
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
const cross_fetch_1 = require("cross-fetch");
const dns_1 = require("dns");
const _ = require("lodash");
const rxjs_1 = require("rxjs");
const symbol_sdk_1 = require("symbol-sdk");
const symbol_statistics_service_typescript_fetch_client_1 = require("symbol-statistics-service-typescript-fetch-client");
const KnownError_1 = require("./KnownError");
const Utils_1 = require("./Utils");
class RemoteNodeService {
    constructor(logger, presetData, offline) {
        this.logger = logger;
        this.presetData = presetData;
        this.offline = offline;
    }
    async resolveCurrentFinalizationEpoch() {
        var _a;
        const votingNode = (_a = this.presetData.nodes) === null || _a === void 0 ? void 0 : _a.find((n) => n.voting);
        if (!votingNode || this.offline) {
            return this.presetData.lastKnownNetworkEpoch;
        }
        if (!(await this.isConnectedToInternet())) {
            return this.presetData.lastKnownNetworkEpoch;
        }
        const urls = await this.getRestUrls();
        return (await this.getBestFinalizationEpoch(urls)) || this.presetData.lastKnownNetworkEpoch;
    }
    async getBestFinalizationEpoch(urls) {
        if (!urls.length) {
            return undefined;
        }
        const repositoryInfo = this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls)).find((i) => i);
        const finalizationEpoch = repositoryInfo === null || repositoryInfo === void 0 ? void 0 : repositoryInfo.chainInfo.latestFinalizedBlock.finalizationEpoch;
        if (finalizationEpoch) {
            this.logger.info(`The current network finalization epoch is ${finalizationEpoch}`);
        }
        return finalizationEpoch;
    }
    async getBestRepositoryInfo(url) {
        const urls = url ? [url] : await this.getRestUrls();
        const repositoryInfo = this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls)).find((i) => i);
        if (!repositoryInfo) {
            throw new Error(`No up and running node could be found out of: \n - ${urls.join('\n - ')}`);
        }
        this.logger.info(`Connecting to node ${repositoryInfo.restGatewayUrl}`);
        return repositoryInfo;
    }
    sortByHeight(repos) {
        return repos
            .filter((b) => b.chainInfo)
            .sort((a, b) => {
            if (!a.chainInfo) {
                return 1;
            }
            if (!b.chainInfo) {
                return -1;
            }
            return b.chainInfo.height.compare(a.chainInfo.height);
        });
    }
    isConnectedToInternet() {
        return new Promise((resolve) => {
            (0, dns_1.lookup)('google.com', (err) => {
                if (err && err.code == 'ENOTFOUND') {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    async getKnownNodeRepositoryInfos(urls) {
        if (!urls.length) {
            throw new KnownError_1.KnownError('There are not known nodes!');
        }
        this.logger.info(`Looking for the best node out of:  \n - ${urls.join('\n - ')}`);
        return (await Promise.all(urls.map(async (restGatewayUrl) => {
            const repositoryFactory = new symbol_sdk_1.RepositoryFactoryHttp(restGatewayUrl);
            try {
                const chainInfo = await (0, rxjs_1.firstValueFrom)(repositoryFactory.createChainRepository().getChainInfo());
                return {
                    restGatewayUrl,
                    repositoryFactory,
                    chainInfo,
                };
            }
            catch (e) {
                const message = `There has been an error talking to node ${restGatewayUrl}. Error: ${Utils_1.Utils.getMessage(e)}`;
                this.logger.warn(message);
                return undefined;
            }
        })))
            .filter((i) => i)
            .map((i) => i);
    }
    async getRestUrls() {
        if (this.restUrls) {
            return this.restUrls;
        }
        const presetData = this.presetData;
        const urls = [...(presetData.knownRestGateways || [])];
        const statisticsServiceUrl = presetData.statisticsServiceUrl;
        if (statisticsServiceUrl && !this.offline) {
            const client = this.createNodeApiRestClient(statisticsServiceUrl);
            try {
                const filter = presetData.statisticsServiceRestFilter;
                const limit = presetData.statisticsServiceRestLimit;
                const nodes = await client.getNodes(filter ? filter : undefined, limit);
                urls.push(...nodes.map((n) => { var _a; return (_a = n.apiStatus) === null || _a === void 0 ? void 0 : _a.restGatewayUrl; }).filter((url) => !!url));
            }
            catch (e) {
                this.logger.warn(`There has been an error connecting to statistics ${statisticsServiceUrl}. Rest urls cannot be resolved! Error ${Utils_1.Utils.getMessage(e)}`);
            }
        }
        if (!urls) {
            throw new Error('Rest URLS could not be resolved!');
        }
        this.restUrls = urls;
        return urls;
    }
    /**
     * Return user friendly role type list
     * @param role combined node role types
     */
    static getNodeRoles(role) {
        const roles = [];
        if ((symbol_sdk_1.RoleType.PeerNode.valueOf() & role) != 0) {
            roles.push('Peer');
        }
        if ((symbol_sdk_1.RoleType.ApiNode.valueOf() & role) != 0) {
            roles.push('Api');
        }
        if ((symbol_sdk_1.RoleType.VotingNode.valueOf() & role) != 0) {
            roles.push('Voting');
        }
        return roles.join(',');
    }
    async getPeerInfos() {
        const presetData = this.presetData;
        const statisticsServiceUrl = presetData.statisticsServiceUrl;
        const knownPeers = [...(presetData.knownPeers || [])];
        if (statisticsServiceUrl && !this.offline) {
            const client = this.createNodeApiRestClient(statisticsServiceUrl);
            try {
                const filter = presetData.statisticsServicePeerFilter;
                const limit = presetData.statisticsServicePeerLimit;
                const nodes = await client.getNodes(filter ? filter : undefined, limit);
                const peerInfos = nodes
                    .map((n) => {
                    var _a;
                    if (!((_a = n.peerStatus) === null || _a === void 0 ? void 0 : _a.isAvailable) || !n.publicKey || !n.port || !n.friendlyName || !n.roles) {
                        return undefined;
                    }
                    return {
                        publicKey: n.publicKey,
                        endpoint: {
                            host: n.host || '',
                            port: n.port,
                        },
                        metadata: {
                            name: n.friendlyName,
                            roles: RemoteNodeService.getNodeRoles(n.roles),
                        },
                    };
                })
                    .filter((peerInfo) => !!peerInfo);
                knownPeers.push(...peerInfos);
            }
            catch (error) {
                this.logger.warn(`There has been an error connecting to statistics ${statisticsServiceUrl}. Peers cannot be resolved! Error ${Utils_1.Utils.getMessage(error)}`);
            }
        }
        return knownPeers;
    }
    createNodeApiRestClient(statisticsServiceUrl) {
        return new symbol_statistics_service_typescript_fetch_client_1.NodeApi(new symbol_statistics_service_typescript_fetch_client_1.Configuration({
            fetchApi: cross_fetch_1.default,
            basePath: statisticsServiceUrl,
            middleware: [
                {
                    pre: (context) => {
                        this.logger.info(`Getting nodes information from ${context.url}`);
                        return Promise.resolve();
                    },
                },
            ],
        }));
    }
    async resolveRestUrlsForServices() {
        var _a;
        const restNodes = [];
        (_a = this.presetData.gateways) === null || _a === void 0 ? void 0 : _a.forEach((restService) => {
            var _a;
            const nodePreset = (_a = this.presetData.nodes) === null || _a === void 0 ? void 0 : _a.find((g) => g.name == restService.apiNodeName);
            restNodes.push(`http://${restService.host || (nodePreset === null || nodePreset === void 0 ? void 0 : nodePreset.host) || 'localhost'}:3000`);
        });
        restNodes.push(...(await this.getRestUrls()));
        const defaultNode = restNodes[0];
        if (!defaultNode) {
            throw new Error('Rest node could not be resolved!');
        }
        return { restNodes: _.uniq(restNodes), defaultNode: defaultNode };
    }
}
exports.RemoteNodeService = RemoteNodeService;
