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

import * as net from 'net';

/**
 * ネットワークポートへの接続可能性を確認するユーティリティクラス。
 */
export class PortUtils {
  /**
   * 指定したホスト・ポートへ TCP 接続を試み、到達可能かどうかを返す。
   * @param port 確認するポート番号
   * @param host 接続先ホスト
   * @param timeout タイムアウト(ミリ秒)。デフォルトは 1000ms。
   */
  public static async isReachable(port: number, host: string, timeout = 1000): Promise<boolean> {
    const promise = new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();

      const onError = () => {
        socket.destroy();
        reject();
      };

      socket.setTimeout(timeout);
      socket.once('error', onError);
      socket.once('timeout', onError);

      socket.connect(port, host, () => {
        socket.end();
        resolve();
      });
    });

    try {
      await promise;
      return true;
    } catch {
      return false;
    }
  }
}
