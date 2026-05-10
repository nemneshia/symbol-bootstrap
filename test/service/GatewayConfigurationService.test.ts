import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { KnownError } from '../../src/errors/KnownError.js';
import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { GatewayConfigurationService } from '../../src/service/GatewayConfigurationService.js';
import { HandlebarsUtils } from '../../src/utils/HandlebarsUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    writeFileSync: vi.fn(),
  };
});

vi.mock('../../src/utils/HandlebarsUtils.js', () => ({
  HandlebarsUtils: {
    generateConfiguration: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('GatewayConfigurationService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  const existsSyncMock = vi.mocked(existsSync);
  const writeFileSyncMock = vi.mocked(writeFileSync);
  const generateConfigurationMock = vi.mocked(HandlebarsUtils.generateConfiguration);

  /** テスト共通のファイルシステムサービス mock */
  const makeFileSystemService = () => ({
    getTargetGatewayFolder: vi.fn((target: string, _abs: boolean, name: string) =>
      join(target, name)
    ),
    getTargetNodesFolder: vi.fn((target: string, _abs: boolean, ...paths: string[]) =>
      join(target, ...paths)
    ),
  });

  /** 最小限のプリセットデータを生成するヘルパー */
  const makePresetData = (overrides: Record<string, unknown> = {}) => {
    const hasExplicitGateway = Object.prototype.hasOwnProperty.call(overrides, 'gateway');
    const presetData: any = {
      restSSLKeyFileName: 'rest.key.pem',
      restSSLCertificateFileName: 'rest.crt.pem',
      gateway: undefined,
      gateways: [],
      ...overrides,
    };
    if (!hasExplicitGateway) {
      if (Array.isArray(presetData.gateways)) {
        presetData.gateway = presetData.gateways[0];
      } else if (presetData.gateways === undefined) {
        presetData.gateway = undefined;
      }
    }
    return presetData;
  };

  /** 最小限のゲートウェイプリセットを生成するヘルパー */
  const makeGatewayPreset = (overrides: Record<string, unknown> = {}) =>
    ({
      name: 'gateway',
      apiNodeName: 'api-node',
      apiNodeHost: 'api-host',
      apiNodeBrokerHost: 'broker-host',
      databaseHost: 'mongo',
      restProtocol: 'HTTP',
      ...overrides,
    }) as any;

  /** ConfigParams の最小実装 */
  const makeParams = () => ({ target: 'target' }) as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // generateGateways
  // ---------------------------------------------------------------------------

  describe('generateGateways', () => {
    it('gateways が空の場合は何もしないこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const presetData = makePresetData({ gateways: [] });

      await service.generateGateways(presetData);

      expect(generateConfigurationMock).not.toHaveBeenCalled();
    });

    it('gateways が undefined の場合は何もしないこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const presetData = makePresetData({ gateways: undefined });

      await service.generateGateways(presetData);

      expect(generateConfigurationMock).not.toHaveBeenCalled();
    });

    it('1 つのゲートウェイに対して設定ファイルを生成すること', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset();
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      // テンプレート展開・API ノード設定・API ノード証明書の 3 回呼ばれること
      expect(generateConfigurationMock).toHaveBeenCalledTimes(3);
    });

    it('複数指定されても先頭ゲートウェイのみ処理すること', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateways = [makeGatewayPreset({ name: 'gw-0' }), makeGatewayPreset({ name: 'gw-1' })];
      const presetData = makePresetData({ gateways });

      await service.generateGateways(presetData);

      // 単数モデルのため先頭ゲートウェイのみ処理される
      expect(generateConfigurationMock).toHaveBeenCalledTimes(3);
    });

    it('name が未指定のゲートウェイには gateway 既定名を使うこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({ name: undefined });
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      expect(fss.getTargetGatewayFolder).toHaveBeenCalledWith('target', false, 'gateway');
    });
  });

  // ---------------------------------------------------------------------------
  // copyApiNodeFiles（generateGateways 経由）
  // ---------------------------------------------------------------------------

  describe('copyApiNodeFiles', () => {
    it('API ノード設定・証明書の generateConfiguration を正しいパスで呼ぶこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({ name: 'gw', apiNodeName: 'my-node' });
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      // 2 番目の呼び出し: api-node-config
      expect(generateConfigurationMock).toHaveBeenNthCalledWith(
        2,
        {},
        join('target', 'my-node', 'server-config', 'resources'),
        join('target', 'gw', 'api-node-config'),
        [],
        ['config-network.properties', 'config-node.properties', 'config-inflation.properties']
      );

      // 3 番目の呼び出し: api-node-config/cert
      expect(generateConfigurationMock).toHaveBeenNthCalledWith(
        3,
        {},
        join('target', 'my-node', 'cert'),
        join('target', 'gw', 'api-node-config', 'cert'),
        [],
        ['node.crt.pem', 'node.key.pem', 'ca.crt.pem']
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleSslCertificates（generateGateways 経由）
  // ---------------------------------------------------------------------------

  describe('handleSslCertificates', () => {
    it('restProtocol が HTTP の場合は SSL 処理をしないこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({ restProtocol: 'HTTP' });
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      expect(writeFileSyncMock).not.toHaveBeenCalled();
      expect(existsSyncMock).not.toHaveBeenCalled();
    });

    it('Base64 データがある場合は SSL ファイルを書き出すこと', async () => {
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({
        restProtocol: 'HTTPS',
        restSSLKeyBase64: 'a2V5ZGF0YQ==',
        restSSLCertificateBase64: 'Y2VydGRhdGE=',
      });
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      const moveTo = join('target', 'gateway');
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        join(moveTo, 'rest.key.pem'),
        'a2V5ZGF0YQ==',
        'base64'
      );
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        join(moveTo, 'rest.crt.pem'),
        'Y2VydGRhdGE=',
        'base64'
      );
    });

    it('Base64 データがなく SSL ファイルも存在しない場合は KnownError をスローすること', async () => {
      existsSyncMock.mockReturnValue(false);
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({ restProtocol: 'HTTPS' });
      const presetData = makePresetData({ gateways: [gateway] });

      await expect(service.generateGateways(presetData)).rejects.toThrow(KnownError);
    });

    it('SSL ファイルが既に存在する場合は Reusing ログを出してスローしないこと', async () => {
      existsSyncMock.mockReturnValue(true);
      const loggerSpy = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(loggerSpy as any, makeParams(), fss as any);
      const gateway = makeGatewayPreset({ restProtocol: 'HTTPS', name: 'gw' });
      const presetData = makePresetData({ gateways: [gateway] });

      await expect(service.generateGateways(presetData)).resolves.not.toThrow();
      expect(loggerSpy.info).toHaveBeenCalledWith(expect.stringContaining('再利用します'));
    });

    it('restSSLKeyBase64 のみ設定されている場合は SSL ファイルを書き出さないこと', async () => {
      existsSyncMock.mockReturnValue(true);
      const fss = makeFileSystemService();
      const service = new GatewayConfigurationService(logger, makeParams(), fss as any);
      const gateway = makeGatewayPreset({
        restProtocol: 'HTTPS',
        restSSLKeyBase64: 'a2V5ZGF0YQ==',
        // restSSLCertificateBase64 は未設定
      });
      const presetData = makePresetData({ gateways: [gateway] });

      await service.generateGateways(presetData);

      // 両方そろっていないため writeFileSync は呼ばれない
      expect(writeFileSyncMock).not.toHaveBeenCalled();
    });
  });
});
