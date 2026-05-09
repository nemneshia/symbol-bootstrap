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
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { Logger } from '../logger/index.js';
import { DockerCompose, DockerComposeService } from '../model/index.js';
import { ICryptoPort, INetworkPort, SymbolCryptoAdapter } from '../sdk/index.js';
import { AsyncUtils } from '../utils/AsyncUtils.js';
import { Constants } from '../utils/Constants.js';
import { PortUtils } from '../utils/PortUtils.js';
import { Utils } from '../utils/Utils.js';
import { YamlUtils } from '../utils/YamlUtils.js';
import { DefaultAccountResolver } from './AccountResolver.js';
import { CertificateService } from './CertificateService.js';
import { ConfigLoader } from './ConfigLoader.js';
import { FileSystemService } from './FileSystemService.js';
import { RuntimeService } from './RuntimeService.js';

/**
 * docker compose ネットワーク起動時に利用するパラメーター。
 */
export type RunParams = {
  detached?: boolean;
  checkHealth?: boolean;
  build?: boolean;
  pullImages?: boolean;
  timeout?: number;
  args?: string[];
  resetData?: boolean;
  target: string;
};

export class RunService {
  public static readonly defaultParams: RunParams = {
    target: Constants.defaultTargetFolder,
    timeout: 60000,
    pullImages: false,
    resetData: false,
  };

  private readonly configLoader: ConfigLoader;
  private readonly fileSystemService: FileSystemService;
  private readonly runtimeService: RuntimeService;

  constructor(
    private readonly logger: Logger,
    protected readonly params: RunParams,
    private readonly networkPort: INetworkPort,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter()
  ) {
    this.configLoader = new ConfigLoader(this.logger);
    this.fileSystemService = new FileSystemService(this.logger);
    this.runtimeService = new RuntimeService(this.logger);
  }

  public async run(): Promise<void> {
    if (this.params.resetData) {
      await this.resetData();
    }

    const basicArgs = this.createUpArgs();

    await this.beforeRun(basicArgs, false);

    const promises: Promise<any>[] = [];
    promises.push(this.basicRun(basicArgs));
    if (this.params.checkHealth) {
      await AsyncUtils.sleep(5000);
      promises.push(this.checkHealth());
    }
    await Promise.all(promises);
  }

  /**
   * docker compose up に渡す基本引数を構築する。
   */
  private createUpArgs(): string[] {
    const args = ['up', '--remove-orphans'];
    if (this.params.detached) {
      args.push('--detach');
    }
    if (this.params.build) {
      args.push('--build');
    }
    if (this.params.args) {
      args.push(
        ...(this.params.args ?? []).flatMap((s) => s.split(' ').map((internal) => internal.trim()))
      );
    }
    return args;
  }

  public async checkHealth(pollIntervalMs = 10000): Promise<void> {
    const dockerFile = this.getComposeFile();
    if (!existsSync(dockerFile)) {
      this.logger.info(
        `Docker compose ${dockerFile} が存在しないため、サービス状態を確認できません。`
      );
      return;
    }
    if (!(await this.checkCertificates())) {
      throw new Error(`証明書の有効期限が近づいています。ログを確認してください。`);
    }
    const dockerCompose: DockerCompose = YamlUtils.fromYaml(
      await YamlUtils.readTextFile(dockerFile)
    );
    const services = Object.values(dockerCompose.services);
    const timeout = this.params.timeout || RunService.defaultParams.timeout || 0;
    const started = await AsyncUtils.poll(
      this.logger,
      () => this.runOneCheck(services),
      timeout,
      pollIntervalMs
    );
    if (!started) {
      throw new Error(`ネットワークが起動しませんでした。`);
    }
    this.logger.info('ネットワークは稼働中です。');
  }

  private async checkCertificates(): Promise<boolean> {
    const presetData = this.configLoader.loadExistingPresetData(this.params.target, false);
    const service = new CertificateService(
      this.logger,
      new DefaultAccountResolver(),
      {
        target: this.params.target,
        user: Constants.CURRENT_USER,
      },
      this.cryptoPort
    );
    if (!presetData.node) {
      return true;
    }
    const allServicesChecks: Promise<boolean>[] = [presetData.node].map(async (nodePreset) => {
      const name = nodePreset.name;
      const certFolder = this.fileSystemService.getTargetNodesFolder(
        this.params.target,
        false,
        name,
        'cert'
      );
      const willExpireReport = await service.willCertificateExpire(
        presetData.symbolServerImage,
        certFolder,
        CertificateService.NODE_CERTIFICATE_FILE_NAME,
        presetData.certificateExpirationWarningInDays
      );
      if (willExpireReport.willExpire) {
        this.logger.warn(
          `ノード ${name} の ${CertificateService.NODE_CERTIFICATE_FILE_NAME} 証明書は ${willExpireReport.expirationDate} に失効予定で、残り ${presetData.certificateExpirationWarningInDays} 日未満です。更新が必要です。`
        );
      } else {
        this.logger.info(
          `ノード ${name} の ${CertificateService.NODE_CERTIFICATE_FILE_NAME} 証明書の失効日は ${willExpireReport.expirationDate} です。現時点では更新不要です。`
        );
      }
      return !willExpireReport.willExpire;
    });
    return (await Promise.all(allServicesChecks)).every((t) => t);
  }

  private async runOneCheck(services: DockerComposeService[]): Promise<boolean> {
    const runningContainers = await this.loadRunningContainerNames();
    const allServicesChecks: Promise<boolean>[] = services.map((service) =>
      this.runServiceHealthCheck(service, runningContainers)
    );
    return (await Promise.all(allServicesChecks)).every((t) => t);
  }

  private async loadRunningContainerNames(): Promise<string[]> {
    const output = (await this.runtimeService.exec('docker ps --format {{.Names}}')).stdout;
    return output
      .split(`\n`)
      .map((line) => line.trim())
      .filter((line) => !!line);
  }

  private async runServiceHealthCheck(
    service: DockerComposeService,
    runningContainers: string[]
  ): Promise<boolean> {
    if (!runningContainers.includes(service.container_name)) {
      this.logger.warn(`コンテナ ${service.container_name} はまだ起動していません。`);
      return false;
    }
    this.logger.info(`コンテナ ${service.container_name} は起動しています`);
    const portChecks = await Promise.all(
      (service.ports ?? []).map((portBind) => this.checkServicePort(service, portBind))
    );
    return portChecks.every((t) => t);
  }

  private async checkServicePort(
    service: DockerComposeService,
    portBind: string
  ): Promise<boolean> {
    const [externalPort, internalPort] = this.parsePortBinding(portBind);
    const portOpen = await PortUtils.isReachable(externalPort, 'localhost');
    if (!portOpen) {
      this.logger.warn(
        `コンテナ ${service.container_name} のポート ${externalPort} -> ${internalPort} はまだ開いていません。`
      );
      return false;
    }
    this.logger.info(
      `コンテナ ${service.container_name} のポート ${externalPort} -> ${internalPort} は開いています`
    );
    return this.checkRestIfNeeded(service, externalPort);
  }

  private parsePortBinding(portBind: string): [number, number] {
    const ports = portBind.split(':');
    const externalPort = Number.parseInt(ports[0], 10);
    const internalPort = ports.length > 1 ? Number.parseInt(ports[1], 10) : externalPort;
    return [externalPort, internalPort];
  }

  private async checkRestIfNeeded(
    service: DockerComposeService,
    externalPort: number
  ): Promise<boolean> {
    const command = service.command;
    if (!command || !command.includes('/symbol-workdir/rest')) {
      return true;
    }
    const baseUrl = `http://localhost:${externalPort}`;
    if (command.includes('start-light')) {
      return this.checkLightRest(baseUrl);
    }
    return this.checkRegularRest(baseUrl);
  }

  private async checkLightRest(url: string): Promise<boolean> {
    const testUrl = `${url}/node/info`;
    this.logger.info(`${testUrl} を確認中`);
    try {
      await this.networkPort.getNodeInfo(url);
      this.logger.info(`REST ${testUrl} は正常に稼働しています...`);
      return true;
    } catch (e) {
      this.logger.warn(`REST ${testUrl} はまだ稼働していません: ${Utils.getMessage(e)}`);
      return false;
    }
  }

  private async checkRegularRest(url: string): Promise<boolean> {
    const testUrl = `${url}/node/health`;
    this.logger.info(`${testUrl} を確認中`);
    try {
      const health = await this.networkPort.getNodeHealth(url);
      if (health.apiNodeStatus === 'Down') {
        this.logger.warn(`REST ${testUrl} はまだ稼働していません: API ノードが Down のままです。`);
        return false;
      }
      if (health.dbStatus === 'Down') {
        this.logger.warn(`REST ${testUrl} はまだ稼働していません: DB が Down のままです。`);
        return false;
      }
      this.logger.info(`REST ${testUrl} は正常に稼働しています...`);
      return true;
    } catch (e) {
      this.logger.warn(`REST ${testUrl} はまだ稼働していません: ${Utils.getMessage(e)}`);
      return false;
    }
  }

  public async resetData(): Promise<void> {
    this.logger.info('データをリセットします');
    const target = this.params.target;
    const preset = this.configLoader.loadExistingPresetData(target, false);
    if (preset.node) {
      const componentConfigFolder = this.fileSystemService.getTargetNodesFolder(
        target,
        false,
        preset.node.name
      );
      const dataFolder = join(componentConfigFolder, 'data');
      const logsFolder = join(componentConfigFolder, 'logs');
      this.fileSystemService.deleteFolder(dataFolder);
      this.fileSystemService.deleteFolder(logsFolder);
      await this.fileSystemService.mkdir(dataFolder);
      await this.fileSystemService.mkdir(logsFolder);
    }
    if (preset.gateway) {
      this.fileSystemService.deleteFolder(
        this.fileSystemService.getTargetGatewayFolder(target, false, preset.gateway.name, 'logs')
      );
    }
    this.fileSystemService.deleteFolder(
      this.fileSystemService.getTargetDatabasesFolder(target, false)
    );
  }

  public async stop(): Promise<void> {
    const args = ['stop'];
    if (await this.beforeRun(args, true)) await this.basicRun(args);
  }

  private async beforeRun(extraArgs: string[], ignoreIfNotFound: boolean): Promise<boolean> {
    const dockerFile = this.getComposeFile();
    const dockerComposeArgs = ['-f', dockerFile];
    const args = [...dockerComposeArgs, ...extraArgs];
    if (!existsSync(dockerFile)) {
      if (ignoreIfNotFound) {
        this.logger.info(
          `Docker compose ${dockerFile} が存在しないためスキップします: docker compose ${args.join(' ')}`
        );
        return false;
      } else {
        throw new Error(
          `Docker compose ${dockerFile} が存在しないため実行できません: docker compose ${args.join(' ')}`
        );
      }
    }

    // sudo 実行時に root 所有で作成されることを避けるため、先にボリュームフォルダーを準備する。
    const dockerCompose: DockerCompose = await YamlUtils.loadYaml(dockerFile, false);
    if (!ignoreIfNotFound && this.params.pullImages) await this.pullImages(dockerCompose);

    const volumeList = Object.values(dockerCompose.services).flatMap(
      (s) => s.volumes?.map((v) => v.split(':')[0]) ?? []
    );

    await Promise.all(
      volumeList.map(async (v) => {
        const volumePath = join(this.params.target, `docker`, v);
        if (!existsSync(volumePath)) await this.fileSystemService.mkdir(volumePath);
        if (v.startsWith('../databases') && Utils.isRoot()) {
          this.logger.info(`フォルダー ${volumePath} に chmod 777 を適用します`);
          chmodSync(volumePath, '777');
        }
      })
    );
    return true;
  }

  private async basicRun(extraArgs: string[]): Promise<string> {
    const dockerFile = this.getComposeFile();
    let dockerComposeArgs = ['compose', '-f', dockerFile];
    // docker compose project
    const presetData = this.configLoader.loadExistingPresetData(this.params.target, false);
    const dockerComposeProjectName = presetData.dockerComposeProjectName;
    if (dockerComposeProjectName) {
      dockerComposeArgs = [...dockerComposeArgs, '-p', dockerComposeProjectName];
    }
    const args = [...dockerComposeArgs, ...extraArgs];
    return this.runtimeService.spawn({ command: 'docker', args: args, useLogger: false });
  }

  private async pullImages(dockerCompose: DockerCompose) {
    const images = [
      ...new Set(
        Object.values(dockerCompose.services)
          .map((s) => s.image)
          .filter((s): s is string => !!s)
      ),
    ];
    await Promise.all(images.map((image) => this.runtimeService.pullImage(image)));
  }

  private getComposeFile(): string {
    return join(this.params.target, `docker`, `compose.yaml`);
  }
}
