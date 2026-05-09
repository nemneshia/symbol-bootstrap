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
import { Addresses, ConfigPreset, CustomPreset } from '../model/index.js';
import { Password } from '../utils/YamlUtils.js';
import { AccountResolver } from './AccountResolver.js';
import { VotingParams } from './VotingService.js';

/**
 * 利用可能な定義済みプリセットの列挙型。
 */
export enum Preset {
  testnet = 'testnet',
  mainnet = 'mainnet',
}

/**
 * ノード構成のアセンブリ種別の列挙型。
 */
export enum Assembly {
  dual = 'dual',
  peer = 'peer',
  api = 'api',
}

/**
 * プリセットごとのデフォルトアセンブリ設定。
 * 現在は明示指定を必須にしているため既定値は持たない。
 */
export const defaultAssembly: Record<string, string> = {};

/**
 * ConfigService の実行パラメーターのインターフェース。
 * VotingParams を継承して投票キー設定も含む。
 */
export interface ConfigParams extends VotingParams {
  reset: boolean;
  upgrade: boolean;
  workingDir: string;
  offline: boolean;
  preset?: string;
  target: string;
  password?: Password;
  user: string;
  assembly?: string;
  customPreset?: string;
  customPresetObject?: CustomPreset;
  accountResolver: AccountResolver;
}

/**
 * ConfigService.run() の戻り値のインターフェース。
 */
export interface ConfigResult {
  addresses: Addresses;
  presetData: ConfigPreset;
}
