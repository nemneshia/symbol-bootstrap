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
import { Addresses, ConfigPreset } from '../model/index.js';
import { Constants } from '../utils/Constants.js';
import { Utils } from '../utils/Utils.js';
import { Password } from '../utils/YamlUtils.js';
import { ConfigLoader } from './ConfigLoader.js';

export interface ExistingConfigurationParams {
  target: string;
  password: Password;
  customPreset?: string;
  workingDir?: string;
}

export interface ExistingConfigurationResult {
  presetData: ConfigPreset;
  addresses: Addresses;
}

/**
 * 既存ターゲット配下の preset / addresses の読み込みと再構成を担当するサービス。
 */
export class ExistingConfigurationService {
  private readonly configLoader: ConfigLoader;

  constructor(private readonly logger: Logger) {
    this.configLoader = new ConfigLoader(logger);
  }

  /**
   * 既存設定を読み込み、必要なプリセット再解決を行って返す。
   */
  public load(params: ExistingConfigurationParams): ExistingConfigurationResult {
    const oldPresetData = this.loadExistingPreset(params);
    const presetData = this.rebuildPresetData(params, oldPresetData);
    const addresses = this.loadExistingAddresses(params);
    return { presetData, addresses };
  }

  /**
   * load の失敗時に補足説明を付与した例外として再送出する。
   */
  public loadOrThrow(
    params: ExistingConfigurationParams,
    errorPrefix: string
  ): ExistingConfigurationResult {
    try {
      return this.load(params);
    } catch (e) {
      throw new Error(`${errorPrefix}${Utils.getMessage(e)}`, { cause: e });
    }
  }

  private loadExistingPreset(params: ExistingConfigurationParams): ConfigPreset {
    return this.configLoader.loadExistingPresetData(params.target, params.password);
  }

  private rebuildPresetData(
    params: ExistingConfigurationParams,
    oldPresetData: ConfigPreset
  ): ConfigPreset {
    return this.configLoader.createPresetData({
      workingDir: params.workingDir ?? Constants.defaultWorkingDir,
      customPreset: params.customPreset,
      password: params.password,
      oldPresetData,
    });
  }

  private loadExistingAddresses(params: ExistingConfigurationParams): Addresses {
    return this.configLoader.loadExistingAddresses(params.target, params.password);
  }
}
