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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import {
  ConfigPreset,
  DockerCompose,
  DockerComposeService,
  DockerServicePreset,
} from '../model/index.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { Utils } from '../utils/Utils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { ConfigLoader } from './ConfigLoader.js';
import { FileSystemService } from './FileSystemService.js';
import { RuntimeService } from './RuntimeService.js';

export type ComposeParams = {
  target: string;
  user?: string;
  upgrade?: boolean;
  password?: Password;
  workingDir: string;
  offline: boolean;
};

const targetDatabasesFolder = Constants.targetDatabasesFolder;

export interface PortConfiguration {
  internalPort: number;
  openPort: number | undefined | boolean | string;
}

/**
 * docker compose 定義の生成を担当するサービス。
 * preset 情報から compose.yaml を組み立て、必要なテンプレート類を docker フォルダーへ配置する。
 */
export class ComposeService {
  public static defaultParams: ComposeParams = {
    target: Constants.defaultTargetFolder,
    user: Constants.CURRENT_USER,
    workingDir: Constants.defaultWorkingDir,
    upgrade: false,
    offline: false,
  };

  public static readonly DEBUG_SERVICE_PARAMS = {
    security_opt: ['seccomp:unconfined'],
    cap_add: ['ALL'],
    privileged: true,
  };

  private readonly configLoader: ConfigLoader;
  private readonly fileSystemService: FileSystemService;

  constructor(
    private readonly logger: Logger,
    protected readonly params: ComposeParams
  ) {
    this.configLoader = new ConfigLoader(logger);
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * コンテナ単位のデバッグ設定と全体デバッグ設定から、compose へ付与するデバッグオプションを解決する。
   */
  public resolveDebugOptions(
    dockerComposeDebugMode: boolean,
    dockerComposeServiceDebugMode: boolean | undefined
  ): any {
    if (dockerComposeServiceDebugMode === false) {
      return {};
    }
    if (dockerComposeServiceDebugMode || dockerComposeDebugMode) {
      return ComposeService.DEBUG_SERVICE_PARAMS;
    }
    return {};
  }

  /**
   * 現在のプリセットから compose.yaml を生成する。
   * compose.yaml が既に存在する場合は再利用する。
   *
   * @param passedPresetData 外部でロード済みのプリセット（省略時は target から読み込み）
   */
  public async run(passedPresetData?: ConfigPreset): Promise<DockerCompose> {
    const presetData =
      passedPresetData ??
      this.configLoader.loadExistingPresetData(this.params.target, this.params.password || false);

    const currentDir = process.cwd();
    const target = join(currentDir, this.params.target);
    const targetDocker = join(target, 'docker');
    const dockerFile = join(targetDocker, 'compose.yaml');

    const reusedCompose = await this.prepareDockerWorkspace(presetData, targetDocker, dockerFile);
    if (reusedCompose) {
      return reusedCompose;
    }

    const user = await new RuntimeService(this.logger).resolveDockerUserFromParam(this.params.user);
    const containerNamePrefix = presetData.dockerComposeProjectName
      ? `${presetData.dockerComposeProjectName}-`
      : '';
    const restInternalPort = 3000;
    const restart = presetData.dockerComposeServiceRestart;

    this.logger.info('前回使用したプロファイルから compose.yaml を作成します。');

    const services = [
      ...(await this.buildDatabaseServices(presetData, user, containerNamePrefix)),
      ...(await this.buildNodeServices(presetData, user, restart, containerNamePrefix)),
      ...(await this.buildGatewayServices(
        presetData,
        user,
        restart,
        containerNamePrefix,
        restInternalPort
      )),
      ...(await this.buildHttpsProxyServices(
        presetData,
        restart,
        containerNamePrefix,
        restInternalPort
      )),
    ];

    return this.buildComposeOutput(services, presetData, dockerFile);
  }

  /**
   * docker 用の作業ディレクトリを準備し、既存 compose.yaml があれば再利用して返す。
   */
  private async prepareDockerWorkspace(
    presetData: ConfigPreset,
    targetDocker: string,
    dockerFile: string
  ): Promise<DockerCompose | undefined> {
    if (this.params.upgrade) {
      this.fileSystemService.deleteFolder(targetDocker);
    }

    if (existsSync(dockerFile)) {
      this.logger.info(
        `${dockerFile} は既に存在します。再利用します。（削除して再作成するには --upgrade を実行してください）`
      );
      return YamlUtils.loadYaml(dockerFile, false);
    }

    await this.fileSystemService.mkdir(targetDocker);
    await HandlebarsUtils.generateConfiguration(
      presetData,
      join(Constants.ROOT_FOLDER, 'config', 'docker'),
      targetDocker
    );
    await this.fileSystemService.chmodRecursive(join(targetDocker, 'mongo'), 0o666);
    return undefined;
  }

  /** 指定したホストパスとコンテナパスから volume 記述を作成する。 */
  private createVolumeBinding(hostFolder: string, imageFolder: string, readOnly: boolean): string {
    return `${hostFolder}:${imageFolder}:${readOnly ? 'ro' : 'rw'}`;
  }

  /** ポート設定を docker compose の host:container 形式へ変換する。 */
  private resolvePortMappings(portConfigurations: PortConfiguration[]): string[] {
    return portConfigurations
      .filter((c) => c.openPort)
      .map(({ openPort, internalPort }) => {
        if (openPort === true || openPort === 'true') {
          return `${internalPort}:${internalPort}`;
        }
        return `${openPort}:${internalPort}`;
      });
  }

  /** HTTPS Proxy の DOMAINS 形式（from -> to）を生成する。 */
  private formatHttpsProxyDomain(fromDomain: string, toDomain: string): string {
    return `${fromDomain} -> ${toDomain}`;
  }

  /** preset 側の compose 拡張を取り込みつつ、共通プロパティを解決したサービス定義を返す。 */
  private async resolveService(
    servicePreset: DockerServicePreset,
    rawService: DockerComposeService
  ): Promise<DockerComposeService> {
    const service = { ...rawService };
    if (servicePreset.host || servicePreset.ipv4_address) {
      service.networks = { default: {} };
    }
    if (servicePreset.host) {
      service.hostname = servicePreset.host;
      service.networks!.default.aliases = [servicePreset.host];
    }
    if (servicePreset.stopGracePeriod) {
      service.stop_grace_period = servicePreset.stopGracePeriod;
    }
    if (servicePreset.ipv4_address) {
      service.networks!.default.ipv4_address = servicePreset.ipv4_address;
    }
    return Utils.deepMerge({}, service, servicePreset.compose);
  }

  /** database サービス定義を構築する。 */
  private async buildDatabaseServices(
    presetData: ConfigPreset,
    user: string | undefined,
    containerNamePrefix: string
  ): Promise<DockerComposeService[]> {
    const n = presetData.database;
    if (!n || n.excludeDockerService) {
      return [];
    }
    const databaseName = n.databaseName || presetData.databaseName;
    const databasePort = 27017;
    return [
      await this.resolveService(n, {
        user,
        environment: { MONGO_INITDB_DATABASE: databaseName },
        container_name: containerNamePrefix + n.name,
        image: presetData.mongoImage,
        command: `mongod --dbpath=/dbdata --bind_ip=${n.name} ${presetData.mongoComposeRunParam}`,
        stop_signal: 'SIGINT',
        working_dir: '/docker-entrypoint-initdb.d',
        ports: this.resolvePortMappings([{ internalPort: databasePort, openPort: n.openPort }]),
        volumes: [
          this.createVolumeBinding('./mongo', '/docker-entrypoint-initdb.d', true),
          this.createVolumeBinding(`../${targetDatabasesFolder}`, '/dbdata', false),
        ],
        ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
      }),
    ];
  }

  /** node / broker サービス定義を構築する。 */
  private async buildNodeServices(
    presetData: ConfigPreset,
    user: string | undefined,
    restart: string | undefined,
    containerNamePrefix: string
  ): Promise<DockerComposeService[]> {
    const nodeWorkingDirectory = '/symbol-workdir';
    const nodeCommandsDirectory = '/symbol-commands';
    const debugFlag = 'DEBUG';

    const n = presetData.node;
    if (!n || n.excludeDockerService) {
      return [];
    }

    const serverDebugMode =
      presetData.dockerComposeDebugMode || n.dockerComposeDebugMode ? debugFlag : 'NORMAL';
    const brokerDebugMode =
      presetData.dockerComposeDebugMode || n.brokerDockerComposeDebugMode ? debugFlag : 'NORMAL';

    const serverCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${
      presetData.dataDirectory
    } server broker ${n.name} ${serverDebugMode} ${!!n.brokerName}`;
    const brokerCommand = `/bin/bash ${nodeCommandsDirectory}/start.sh ${presetData.catapultAppFolder} ${
      presetData.dataDirectory
    } broker server ${n.brokerName || 'broker'} ${brokerDebugMode}`;

    const internalPort = typeof n.openPort === 'number' ? n.openPort : 7900;
    const serverDependsOn: string[] = [];
    const brokerDependsOn: string[] = [];
    if (n.databaseHost) {
      serverDependsOn.push(n.databaseHost);
      brokerDependsOn.push(n.databaseHost);
    }
    if (n.brokerName) {
      serverDependsOn.push(n.brokerName);
    }

    const volumes = [
      this.createVolumeBinding(`../${n.name}`, nodeWorkingDirectory, false),
      this.createVolumeBinding('./server', nodeCommandsDirectory, true),
    ];

    const nodeService = await this.resolveService(
      {
        ipv4_address: n.ipv4_address,
        openPort: n.openPort,
        excludeDockerService: n.excludeDockerService,
        host: n.host,
        compose: n.compose,
        stopGracePeriod: n.nodeStopGracePeriod || presetData.nodeStopGracePeriod,
      },
      {
        user: serverDebugMode === debugFlag ? undefined : user,
        container_name: containerNamePrefix + n.name,
        image: presetData.symbolServerImage,
        command: serverCommand,
        stop_signal: 'SIGINT',
        working_dir: nodeWorkingDirectory,
        restart,
        ports: this.resolvePortMappings([{ internalPort, openPort: n.openPort }]),
        ulimits: { nofile: { soft: 1048576, hard: 1048576 } },
        volumes,
        depends_on: serverDependsOn,
        ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
      }
    );

    const result: DockerComposeService[] = [nodeService];
    if (n.brokerName) {
      result.push(
        await this.resolveService(
          {
            ipv4_address: n.brokerIpv4_address,
            openPort: n.brokerOpenPort,
            excludeDockerService: n.brokerExcludeDockerService,
            host: n.brokerHost,
            compose: n.brokerCompose,
            stopGracePeriod: n.brokerStopGracePeriod || presetData.brokerStopGracePeriod,
          },
          {
            user: brokerDebugMode === debugFlag ? undefined : user,
            container_name: containerNamePrefix + n.brokerName,
            image: nodeService.image,
            working_dir: nodeWorkingDirectory,
            command: brokerCommand,
            ports: this.resolvePortMappings([{ internalPort: 7902, openPort: n.brokerOpenPort }]),
            stop_signal: 'SIGINT',
            restart,
            volumes: nodeService.volumes,
            depends_on: brokerDependsOn,
            ...this.resolveDebugOptions(
              presetData.dockerComposeDebugMode,
              n.brokerDockerComposeDebugMode
            ),
          }
        )
      );
    }

    return result;
  }

  /** gateway サービス定義を構築する。 */
  private async buildGatewayServices(
    presetData: ConfigPreset,
    user: string | undefined,
    restart: string | undefined,
    containerNamePrefix: string,
    restInternalPort: number
  ): Promise<DockerComposeService[]> {
    const nodeWorkingDirectory = '/symbol-workdir';
    const n = presetData.gateway;
    if (!n || n.excludeDockerService) {
      return [];
    }
    const volumes = [this.createVolumeBinding(`../${n.name}`, nodeWorkingDirectory, false)];
    const command = n.databaseHost
      ? 'npm start --prefix /app /symbol-workdir/rest.json'
      : 'npm run start-light --prefix /app /symbol-workdir/rest.light.json';
    const dependsOn = n.databaseHost ? [n.databaseHost] : undefined;

    return [
      await this.resolveService(n, {
        container_name: containerNamePrefix + n.name,
        user,
        environment: { npm_config_cache: nodeWorkingDirectory },
        image: presetData.symbolRestImage,
        command,
        stop_signal: 'SIGINT',
        working_dir: nodeWorkingDirectory,
        ports: this.resolvePortMappings([{ internalPort: restInternalPort, openPort: n.openPort }]),
        restart,
        volumes,
        depends_on: dependsOn,
        ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
      }),
    ];
  }

  /** https proxy サービス定義を構築する。 */
  private async buildHttpsProxyServices(
    presetData: ConfigPreset,
    restart: string | undefined,
    containerNamePrefix: string,
    restInternalPort: number
  ): Promise<DockerComposeService[]> {
    const n = presetData.httpsProxy;
    if (!n || n.excludeDockerService) {
      return [];
    }

    const resolveHost = (): string => {
      const host = n.host || presetData.node?.host;
      if (!host) {
        throw new KnownError(
          `HTTPS Proxy ${n.name} is invalid, 'host' property could not be resolved. It must be set to a valid DNS record.`
        );
      }
      return host;
    };

    const domains =
      n.domains ||
      (presetData.gateway
        ? this.formatHttpsProxyDomain(
            resolveHost(),
            `http://${presetData.gateway.name}:${restInternalPort}`
          )
        : undefined);

    if (!domains) {
      throw new KnownError(
        `HTTPS Proxy ${n.name} is invalid, 'domains' property could not be resolved!`
      );
    }

    const restDependency = presetData.gateway?.name;
    return [
      await this.resolveService(n, {
        container_name: containerNamePrefix + n.name,
        image: presetData.httpsPortalImage,
        stop_signal: 'SIGINT',
        ports: this.resolvePortMappings([
          { internalPort: 80, openPort: true },
          { internalPort: 443, openPort: n.openPort },
        ]),
        environment: {
          DOMAINS: domains,
          WEBSOCKET: n.webSocket,
          STAGE: n.stage,
          SERVER_NAMES_HASH_BUCKET_SIZE: n.serverNamesHashBucketSize,
        },
        restart,
        depends_on: restDependency ? [restDependency] : [],
        ...this.resolveDebugOptions(presetData.dockerComposeDebugMode, n.dockerComposeDebugMode),
      }),
    ];
  }

  /** 生成したサービス一覧から DockerCompose を組み立て、compose.yaml へ保存する。 */
  private async buildComposeOutput(
    services: DockerComposeService[],
    presetData: ConfigPreset,
    dockerFile: string
  ): Promise<DockerCompose> {
    const servicesMap = Object.fromEntries(services.map((s) => [s.container_name, s]));
    let dockerCompose: DockerCompose = {
      services: servicesMap,
    };

    if (presetData.subnet) {
      dockerCompose.networks = {
        default: {
          ipam: {
            config: [{ subnet: presetData.subnet }],
          },
        },
      };
    }

    dockerCompose = Utils.pruneEmpty(Utils.deepMerge({}, dockerCompose, presetData.compose));
    await YamlUtils.writeYaml(dockerFile, dockerCompose, undefined);
    this.logger.info(`compose.yaml ファイルを作成しました: ${dockerFile}`);
    return dockerCompose;
  }
}
