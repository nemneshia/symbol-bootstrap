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

import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, DockerCompose } from '../model/index.js';
import { SymbolCryptoAdapter, SymbolNetworkAdapter } from '../sdk/index.js';
import { ComposeParams, ComposeService } from './ComposeService.js';
import { ConfigParams, ConfigResult, ConfigService } from './ConfigService.js';
import { LinkParams, LinkService } from './LinkService.js';
import { ModifyMultisigParams, ModifyMultisigService } from './ModifyMultisigService.js';
import { RunParams, RunService } from './RunService.js';

export type StartParams = ConfigParams & ComposeParams & RunParams;

/**
 * Main entry point for API integration.
 */
export class BootstrapService {
  private readonly cryptoPort = new SymbolCryptoAdapter();
  private readonly networkPort = new SymbolNetworkAdapter();

  public constructor(private readonly logger: Logger) {}

  public config(config: ConfigParams): Promise<ConfigResult> {
    return new ConfigService(this.logger, config, this.cryptoPort, this.networkPort).run();
  }

  public resolveConfigPreset(config: ConfigParams): ConfigPreset {
    return new ConfigService(this.logger, config, this.cryptoPort, this.networkPort).resolveConfigPreset(false);
  }

  public compose(config: ComposeParams, passedPresetData?: ConfigPreset, passedAddresses?: Addresses): Promise<DockerCompose> {
    return new ComposeService(this.logger, config, this.networkPort).run(passedPresetData, passedAddresses);
  }

  public link(config: LinkParams, passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
    return new LinkService(this.logger, config, this.cryptoPort, this.networkPort).run(passedPresetData, passedAddresses);
  }

  public modifyMultisig(
    config: ModifyMultisigParams,
    passedPresetData?: ConfigPreset | undefined,
    passedAddresses?: Addresses | undefined,
  ): Promise<void> {
    return new ModifyMultisigService(this.logger, config, this.cryptoPort, this.networkPort).run(passedPresetData, passedAddresses);
  }

  public run(config: RunParams): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).run();
  }

  public resetData(config: { target: string }): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).resetData();
  }

  public healthCheck(config: { target: string }): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).healthCheck();
  }

  public async start(config: StartParams): Promise<ConfigResult> {
    const configResult = await this.config(config);
    await this.compose(config, configResult.presetData);
    await this.run(config);
    return configResult;
  }

  public stop(config: RunParams): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).stop();
  }
}
