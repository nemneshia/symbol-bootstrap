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

import { expect, vi } from 'vitest';

import { join } from 'path';
import { ConfigPreset, LoggerFactory, LogType, NodewatchPeer, YamlUtils } from '../../src';
import { ConfigLoader, Preset, RemoteNodeService } from '../../src/service';
const logger = LoggerFactory.getLogger(LogType.Silent);

/** NodewatchPeer mock data derived from the original Statistics Service test fixtures */
const mockNodes: NodewatchPeer[] = [
  {
    balance: 0,
    endpoint: 'https://dual-001.testnet.symbol.dev:3001',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: {
      city: 'Ashburn',
      continent: 'North America',
      country: 'United States',
      isp: 'AWS',
      lat: 39.04,
      lon: -77.49,
      region: 'VA',
    },
    height: 517611,
    isHealthy: true,
    isSslEnabled: true,
    mainPublicKey: 'E3FC28889BDE31406465167F1D9D6A16DCA1FF67A3BABFA5E5A8596478848F78',
    name: 'dual-001',
    nodePublicKey: 'A2160AB911943082C88109DD8B65A0082EF547CA7C28F001F857112F7ADD9B3D',
    restVersion: '2.3.8',
    roles: 3,
    version: '1.0.3.7',
    host: 'dual-001.testnet.symbol.dev',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: 'https://sym-test-06.opening-line.jp:3001',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: { city: 'Vilnius', continent: 'Europe', country: 'Lithuania', isp: 'RACKRAY', lat: 54.71, lon: 25.3, region: 'VL' },
    height: 517611,
    isHealthy: true,
    isSslEnabled: true,
    mainPublicKey: '4675E1626A35EF8B9537486D93BB6B488960712A653CB62D27404D35E92F53A9',
    name: 'sym-test-06.opening-line.jp',
    nodePublicKey: '50F34D96117E020BBB48C81C719A020C40729BF3D48483751D6CA8198FFB52C9',
    restVersion: '2.3.6',
    roles: 3,
    version: '1.0.3.7',
    host: 'sym-test-06.opening-line.jp',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: '',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: { city: 'Singapore', continent: 'Asia', country: 'Singapore', isp: 'AWS', lat: 1.28, lon: 103.85, region: '' },
    height: 517611,
    isHealthy: true,
    isSslEnabled: false,
    mainPublicKey: '2489946E49B03D9BE040E3FD42FEBC705D001A746BD25399E2796D615B35B732',
    name: 'peer-601',
    nodePublicKey: '2489946E49B03D9BE040E3FD42FEBC705D001A746BD25399E2796D615B35B732',
    restVersion: '',
    roles: 5,
    version: '1.0.3.7',
    host: 'peer-601.testnet.symbol.dev',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: 'http://AMATERASU.symbol-node.com:3000',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: { city: 'Nara', continent: 'Asia', country: 'Japan', isp: 'OPTAGE', lat: 34.69, lon: 135.85, region: '29' },
    height: 517611,
    isHealthy: true,
    isSslEnabled: false,
    mainPublicKey: 'DB14A11E28CA1EF8BC45657BA3FF0879946A57D8F7370C585819365521C6449C',
    name: 'AMATERASU.symbol-node.com(TEST)',
    nodePublicKey: 'B46268513DDCC2A74241E11F2A38F2FCC6CB655E7CBBD95DA6B32266B5CA88ED',
    restVersion: '2.3.6',
    roles: 3,
    version: '1.0.3.7',
    host: 'AMATERASU.symbol-node.com',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: 'https://iroha-symbolnode.com:3001',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: {
      city: 'Seattle',
      continent: 'North America',
      country: 'United States',
      isp: 'Contabo',
      lat: 47.6,
      lon: -122.34,
      region: 'WA',
    },
    height: 517611,
    isHealthy: true,
    isSslEnabled: true,
    mainPublicKey: '26BEC23EF633936BAB5E501F03E0C374036F5FF20AC068972839357851411496',
    name: '168nihoheto_VDS_S',
    nodePublicKey: '01438DDE96FD4816726F8B80CC012DC85FED6CDA45F9B932887A3512593CFA51',
    restVersion: '2.3.6',
    roles: 3,
    version: '1.0.3.7',
    host: 'iroha-symbolnode.com',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: 'https://dual-101.testnet.symbol.dev:3001',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: {
      city: 'San Jose',
      continent: 'North America',
      country: 'United States',
      isp: 'AWS',
      lat: 37.34,
      lon: -121.9,
      region: 'CA',
    },
    height: 517611,
    isHealthy: true,
    isSslEnabled: true,
    mainPublicKey: 'C4348215B4C417D3E4B52ACAA3D370D29DE3A5F482CAED3C9F1BE257DD2B4079',
    name: 'dual-101',
    nodePublicKey: 'F81F749613EF3BC10BB9670A6FAF49BFA95079898E2034255B8256FBA3FD105D',
    restVersion: '2.3.8',
    roles: 3,
    version: '1.0.3.7',
    host: 'dual-101.testnet.symbol.dev',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: '',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: { city: 'Dublin', continent: 'Europe', country: 'Ireland', isp: 'AWS', lat: 53.35, lon: -6.26, region: 'L' },
    height: 517611,
    isHealthy: true,
    isSslEnabled: false,
    mainPublicKey: 'DC7A90D0676DB3A2D963768276F606AF76541A59588B23C6C6B48D98E0AC3837',
    name: 'peer-301',
    nodePublicKey: 'DC7A90D0676DB3A2D963768276F606AF76541A59588B23C6C6B48D98E0AC3837',
    restVersion: '',
    roles: 1,
    version: '1.0.3.7',
    host: 'peer-301.testnet.symbol.dev',
    port: 7900,
  },
  {
    balance: 0,
    endpoint: 'https://sym-test-02.opening-line.jp:3001',
    finalizedEpoch: 720,
    finalizedHash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
    finalizedHeight: 517596,
    finalizedPoint: 43,
    geoLocation: {
      city: 'St Louis',
      continent: 'North America',
      country: 'United States',
      isp: 'Contabo',
      lat: 38.63,
      lon: -90.2,
      region: 'MO',
    },
    height: 517611,
    isHealthy: true,
    isSslEnabled: true,
    mainPublicKey: '97A7D1E1889803D4A5E3F372530EB555C495B23012807E3E94EF15A2205BC3A6',
    name: 'sym-test-02.opening-line.jp',
    nodePublicKey: '81448301A61412CE24F679C67136CF56DF43216EEAB3065677AA4ECFD0441B59',
    restVersion: '2.3.6',
    roles: 3,
    version: '1.0.3.7',
    host: 'sym-test-02.opening-line.jp',
    port: 7900,
  },
];

const customPresetObject = {
  lastKnownNetworkEpoch: 1,
  nodeUseRemoteAccount: true,
  nodes: [
    {
      mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
      friendlyName: 'myFriendlyName',
    },
  ],
  knownRestGateways: ['http://staticRest1:3000', 'https://staticRest2:3001'],
  knownPeers: [
    {
      publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
      endpoint: { host: 'someStaticPeer', port: 7900 },
      metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
    },
  ],
};
const preset = Preset.testnet;
const root = './';
const networkPresetLocation = `${root}/presets/${preset}/network.yml`;
const sharedPresetLocation = join(root, 'presets', 'shared.yml');
const sharedPreset = YamlUtils.loadYaml(sharedPresetLocation, false);
const networkPreset = YamlUtils.loadYaml(networkPresetLocation, false);
const presetData: ConfigPreset = new ConfigLoader(logger).mergePresets(sharedPreset, networkPreset, customPresetObject);

/** mockNodes with empty endpoints: causes getPeerInfos to skip /node/info fetch, using host/port as-is */
const mockNodesPeer: NodewatchPeer[] = mockNodes.map((n) => ({ ...n, endpoint: '' }));

describe('RemoteNodeService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('getRestUrls online', async () => {
    vi.spyOn(RemoteNodeService.prototype, 'getNodes').mockResolvedValue(mockNodes);
    const service = new RemoteNodeService(logger, presetData, false);
    const urls = await service.getRestUrls();
    expect(urls).deep.eq([
      'http://staticRest1:3000',
      'https://staticRest2:3001',
      'https://dual-001.testnet.symbol.dev:3001',
      'https://sym-test-06.opening-line.jp:3001',
      'http://AMATERASU.symbol-node.com:3000',
      'https://iroha-symbolnode.com:3001',
      'https://dual-101.testnet.symbol.dev:3001',
      'https://sym-test-02.opening-line.jp:3001',
    ]);
  });
  it('getRestUrls offline', async () => {
    vi.spyOn(RemoteNodeService.prototype, 'getNodes').mockResolvedValue(mockNodes);
    const service = new RemoteNodeService(logger, presetData, true);
    const urls = await service.getRestUrls();
    expect(urls).deep.eq(['http://staticRest1:3000', 'https://staticRest2:3001']);
  });
  it('getPeerInfos online', async () => {
    vi.spyOn(RemoteNodeService.prototype, 'getNodes').mockResolvedValue(mockNodesPeer);
    const service = new RemoteNodeService(logger, presetData, false);
    const peerInfos = await service.getPeerInfos();
    expect(peerInfos).deep.eq([
      {
        publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
        endpoint: { host: 'someStaticPeer', port: 7900 },
        metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
      },
      {
        publicKey: 'E3FC28889BDE31406465167F1D9D6A16DCA1FF67A3BABFA5E5A8596478848F78',
        endpoint: { host: 'dual-001.testnet.symbol.dev', port: 7900 },
        metadata: { name: 'dual-001', roles: 'Peer,Api' },
      },
      {
        publicKey: '4675E1626A35EF8B9537486D93BB6B488960712A653CB62D27404D35E92F53A9',
        endpoint: { host: 'sym-test-06.opening-line.jp', port: 7900 },
        metadata: { name: 'sym-test-06.opening-line.jp', roles: 'Peer,Api' },
      },
      {
        publicKey: '2489946E49B03D9BE040E3FD42FEBC705D001A746BD25399E2796D615B35B732',
        endpoint: { host: 'peer-601.testnet.symbol.dev', port: 7900 },
        metadata: { name: 'peer-601', roles: 'Peer,Voting' },
      },
      {
        publicKey: 'DB14A11E28CA1EF8BC45657BA3FF0879946A57D8F7370C585819365521C6449C',
        endpoint: { host: 'AMATERASU.symbol-node.com', port: 7900 },
        metadata: { name: 'AMATERASU.symbol-node.com(TEST)', roles: 'Peer,Api' },
      },
      {
        publicKey: '26BEC23EF633936BAB5E501F03E0C374036F5FF20AC068972839357851411496',
        endpoint: { host: 'iroha-symbolnode.com', port: 7900 },
        metadata: { name: '168nihoheto_VDS_S', roles: 'Peer,Api' },
      },
      {
        publicKey: 'C4348215B4C417D3E4B52ACAA3D370D29DE3A5F482CAED3C9F1BE257DD2B4079',
        endpoint: { host: 'dual-101.testnet.symbol.dev', port: 7900 },
        metadata: { name: 'dual-101', roles: 'Peer,Api' },
      },
      {
        publicKey: 'DC7A90D0676DB3A2D963768276F606AF76541A59588B23C6C6B48D98E0AC3837',
        endpoint: { host: 'peer-301.testnet.symbol.dev', port: 7900 },
        metadata: { name: 'peer-301', roles: 'Peer' },
      },
      {
        publicKey: '97A7D1E1889803D4A5E3F372530EB555C495B23012807E3E94EF15A2205BC3A6',
        endpoint: { host: 'sym-test-02.opening-line.jp', port: 7900 },
        metadata: { name: 'sym-test-02.opening-line.jp', roles: 'Peer,Api' },
      },
    ]);
  });
  it('getPeerInfos offline', async () => {
    vi.spyOn(RemoteNodeService.prototype, 'getNodes').mockResolvedValue(mockNodesPeer);
    const service = new RemoteNodeService(logger, presetData, true);
    const peerInfos = await service.getPeerInfos();
    expect(peerInfos).deep.eq([
      {
        publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
        endpoint: { host: 'someStaticPeer', port: 7900 },
        metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
      },
    ]);
  });
  const assertPeersOnInvalidUrl = async (statisticsServiceUrl: string) => {
    vi.spyOn(RemoteNodeService.prototype, 'getNodes').mockRejectedValue(new Error(`Network error connecting to ${statisticsServiceUrl}`));
    presetData.statisticsServiceUrl = statisticsServiceUrl;
    const service = new RemoteNodeService(logger, presetData, false);
    const peerInfos = await service.getPeerInfos();
    // only static nodes are returned when the statistics service client fails
    expect(peerInfos).deep.eq([
      {
        publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
        endpoint: { host: 'someStaticPeer', port: 7900 },
        metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
      },
    ]);
  };

  it('getPeerInfos unknown statisticsServiceUrl', async () => {
    await assertPeersOnInvalidUrl('https://testnet.symbol.invalid');
  });

  it('getPeerInfos invalid statisticsServiceUrl path', async () => {
    await assertPeersOnInvalidUrl('https://testnet.symbol.services/invalid');
  });
});
