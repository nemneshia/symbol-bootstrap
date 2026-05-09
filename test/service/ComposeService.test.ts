import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';
import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { ComposeParams, ComposeService } from '../../src/service/ComposeService.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { RuntimeService } from '../../src/service/RuntimeService.js';
import { HandlebarsUtils } from '../../src/utils/HandlebarsUtils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: ((path: any) => {
      const text = String(path);
      if (text.endsWith('compose.yaml')) {
        return existsSyncMock(path);
      }
      return actual.existsSync(path);
    }) as typeof actual.existsSync,
  };
});

const logger = LoggerFactory.getLogger(LogType.Silent);

const createParams = (upgrade = false): ComposeParams => ({
  target: 'target',
  user: 'current',
  workingDir: '.',
  password: false,
  offline: false,
  upgrade,
});

const createPreset = (): any => {
  const preset: any = {
    dockerComposeProjectName: 'proj',
    dockerComposeDebugMode: false,
    dockerComposeServiceRestart: 'always',
    mongoImage: 'mongo:6',
    mongoComposeRunParam: '--quiet',
    databaseName: 'catapult',
    symbolServerImage: 'symbol-server:latest',
    symbolRestImage: 'symbol-rest:latest',
    httpsPortalImage: 'https-portal:latest',
    catapultAppFolder: '/catapult',
    dataDirectory: '/data',
    compose: {},
    database: { name: 'db-0', openPort: true },
    node: {
      name: 'node-0',
      host: 'node0.local',
      databaseHost: 'db-0',
      openPort: 'true',
      brokerName: 'broker-0',
      brokerHost: 'broker0.local',
      brokerOpenPort: 7905,
    },
    gateway: { name: 'rest-0', openPort: 3000, databaseHost: 'db-0' },
    httpsProxy: { name: 'https-0', openPort: true },
  };

  Object.defineProperties(preset, {
    databases: {
      get() {
        return this.database ? [this.database] : [];
      },
      set(value) {
        this.database = Array.isArray(value) ? value[0] : value;
      },
      enumerable: true,
    },
    nodes: {
      get() {
        return this.node ? [this.node] : [];
      },
      set(value) {
        this.node = Array.isArray(value) ? value[0] : value;
      },
      enumerable: true,
    },
    gateways: {
      get() {
        return this.gateway ? [this.gateway] : [];
      },
      set(value) {
        this.gateway = Array.isArray(value) ? value[0] : value;
      },
      enumerable: true,
    },
    httpsProxies: {
      get() {
        return this.httpsProxy ? [this.httpsProxy] : [];
      },
      set(value) {
        this.httpsProxy = Array.isArray(value) ? value[0] : value;
      },
      enumerable: true,
    },
  });

  return preset;
};

describe('ComposeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(FileSystemService.prototype, 'deleteFolder').mockImplementation(() => undefined);
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(FileSystemService.prototype, 'chmodRecursive').mockResolvedValue(undefined);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue(createPreset());
    vi.spyOn(RuntimeService.prototype, 'resolveDockerUserFromParam').mockResolvedValue('1000:1000');
    vi.spyOn(HandlebarsUtils, 'generateConfiguration').mockResolvedValue(undefined);
    vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ services: {} } as any);
  });

  describe('resolveDebugOptions', () => {
    it('dockerComposeServiceDebugMode=false の場合は常に空オブジェクトを返すこと', () => {
      const service = new ComposeService(logger, createParams());
      expect(service.resolveDebugOptions(true, false)).toEqual({});
    });

    it('dockerComposeServiceDebugMode=true の場合は DEBUG_SERVICE_PARAMS を返すこと', () => {
      const service = new ComposeService(logger, createParams());
      expect(service.resolveDebugOptions(false, true)).toEqual(ComposeService.DEBUG_SERVICE_PARAMS);
    });

    it('global debug=true の場合は DEBUG_SERVICE_PARAMS を返すこと', () => {
      const service = new ComposeService(logger, createParams());
      expect(service.resolveDebugOptions(true, undefined)).toEqual(
        ComposeService.DEBUG_SERVICE_PARAMS
      );
    });
  });

  describe('run', () => {
    it('既存 compose.yaml がある場合は再利用して返すこと', async () => {
      existsSyncMock.mockReturnValue(true);
      const service = new ComposeService(logger, createParams());

      const result = await service.run(createPreset());

      expect(YamlUtils.loadYaml).toHaveBeenCalledOnce();
      expect(result).toEqual({ services: {} });
      expect(HandlebarsUtils.generateConfiguration).not.toHaveBeenCalled();
    });

    it('upgrade=true の場合は docker フォルダーを削除すること', async () => {
      existsSyncMock.mockReturnValue(true);
      const service = new ComposeService(logger, createParams(true));

      await service.run(createPreset());

      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledOnce();
    });

    it('passedPresetData 未指定時は ConfigLoader からプリセットを読み込むこと', async () => {
      existsSyncMock.mockReturnValue(true);
      const service = new ComposeService(logger, createParams());

      await service.run();

      expect(ConfigLoader.prototype.loadExistingPresetData).toHaveBeenCalledOnce();
    });

    it('compose を新規生成して writeYaml まで実行すること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();

      const result = await service.run(preset);

      expect(FileSystemService.prototype.mkdir).toHaveBeenCalled();
      expect(HandlebarsUtils.generateConfiguration).toHaveBeenCalled();
      expect(FileSystemService.prototype.chmodRecursive).toHaveBeenCalled();
      expect(YamlUtils.writeYaml).toHaveBeenCalledOnce();
      expect(result.services['proj-db-0']).toBeDefined();
      expect(result.services['proj-node-0']).toBeDefined();
      expect(result.services['proj-broker-0']).toBeDefined();
      expect(result.services['proj-rest-0']).toBeDefined();
      expect(result.services['proj-https-0']).toBeDefined();
    });

    it('subnet が指定されている場合は networks.ipam を設定すること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = { ...createPreset(), subnet: '172.20.0.0/16' };

      const result = await service.run(preset);

      expect(result.networks?.default?.ipam?.config?.[0]?.subnet).toBe('172.20.0.0/16');
    });

    it('openPort が true / "true" / number のポートマッピングを解決すること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.databases[0].openPort = true;
      preset.nodes[0].openPort = 'true';
      preset.nodes[0].brokerOpenPort = 7905;

      const result = await service.run(preset);

      expect(result.services['proj-db-0'].ports).toContain('27017:27017');
      expect(result.services['proj-node-0'].ports).toContain('7900:7900');
      expect(result.services['proj-broker-0'].ports).toContain('7905:7902');
    });

    it('gateway の databaseHost がある場合は通常 command になること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.gateway = { name: 'rest-db', openPort: 3000, databaseHost: 'db-0' };

      const result = await service.run(preset);

      expect(result.services['proj-rest-db'].command).toContain('npm start --prefix /app');
    });

    it('node debug mode の場合は user を未設定（root実行）にすること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.nodes[0].dockerComposeDebugMode = true;

      const result = await service.run(preset);

      expect(result.services['proj-node-0'].user).toBeUndefined();
    });

    it('stopGracePeriod と ipv4_address が指定された場合は compose に反映されること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.nodes[0].host = undefined;
      preset.nodes[0].ipv4_address = '172.20.0.10';
      preset.nodes[0].nodeStopGracePeriod = '20s';
      preset.httpsProxies[0].host = 'proxy.local';

      const result = await service.run(preset);

      expect(result.services['proj-node-0'].stop_grace_period).toBe('20s');
      expect(result.services['proj-node-0'].networks?.default?.ipv4_address).toBe('172.20.0.10');
    });

    it('https proxy で host が解決できない場合は KnownError を投げること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.nodes = [];
      preset.httpsProxies = [{ name: 'https-invalid', openPort: true }];
      preset.gateways = [{ name: 'rest-0', openPort: 3000 }];

      await expect(service.run(preset)).rejects.toBeInstanceOf(KnownError);
    });

    it('https proxy で domains が解決できない場合は KnownError を投げること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.httpsProxies = [{ name: 'https-invalid', host: 'proxy.local', openPort: true }];
      preset.gateways = [];

      await expect(service.run(preset)).rejects.toBeInstanceOf(KnownError);
    });

    it('https proxy の domains 未指定時は gateway 名から自動解決すること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.gateways = [{ name: 'rest-0', openPort: 3000 }];
      preset.httpsProxies = [{ name: 'https-0', host: 'public.example.com', openPort: 443 }];

      const result = await service.run(preset);

      expect(result.services['proj-https-0'].environment?.DOMAINS).toContain(
        'public.example.com -> http://rest-0:3000'
      );
    });

    it('compose の上書き設定を deepMerge できること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.compose = { services: { 'proj-node-0': { restart: 'on-failure' } } };

      const result = await service.run(preset);

      expect(result.services['proj-node-0'].restart).toBe('on-failure');
    });

    it('dockerComposeProjectName 未指定時は container_name に prefix を付けないこと', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.dockerComposeProjectName = undefined;

      const result = await service.run(preset);

      expect(result.services['rest-0']).toBeDefined();
      expect(result.services['https-0']).toBeDefined();
    });

    it('services 配列が未指定でも compose を生成できること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.databases = undefined;
      preset.nodes = undefined;
      preset.gateways = undefined;
      preset.httpsProxies = undefined;

      const result = await service.run(preset);

      expect(result.services).toBeUndefined();
    });

    it('brokerName と databaseHost が無い node でも server サービスのみ生成できること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.nodes = [{ name: 'node-single', openPort: 7900 }];
      preset.httpsProxies[0].host = 'proxy.local';

      const result = await service.run(preset);

      expect(result.services['proj-node-single']).toBeDefined();
      expect(result.services['proj-broker-0']).toBeUndefined();
    });

    it('https proxy で domains が明示されていれば gateway なしでも生成できること', async () => {
      existsSyncMock.mockReturnValue(false);
      const service = new ComposeService(logger, createParams());
      const preset = createPreset();
      preset.gateways = [];
      preset.httpsProxies = [
        {
          name: 'https-explicit',
          host: 'proxy.local',
          openPort: 443,
          domains: 'proxy.local -> http://backend:3000',
        },
      ];

      const result = await service.run(preset);

      expect(result.services['proj-https-explicit']).toBeDefined();
      expect(result.services['proj-https-explicit'].depends_on).toBeUndefined();
    });
  });
});
