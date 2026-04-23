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

import { runCommand } from '@oclif/test';
import { expect } from 'vitest';
import { existsSync } from 'fs';
import { CryptoUtils, FileSystemService, LoggerFactory, LogType, YamlUtils } from '../../src';
const logger = LoggerFactory.getLogger(LogType.Silent);
const fileSystemService = new FileSystemService(logger);
describe('encrypt', () => {
  it('runs encrypt and creates file', async () => {
    fileSystemService.deleteFolder('target/tests.encrypt');
    const { stdout } = await runCommand(
      'encrypt --source test/encrypt/plain.yml --destination target/tests.encrypt/encrypted.yml --password 1111'.split(' '),
    );
    expect(stdout).to.contain('Encrypted file target/tests.encrypt/encrypted.yml has been created!');
    expect(existsSync('target/tests.encrypt/encrypted.yml')).eq(true);
    expect(await YamlUtils.loadYaml('target/tests.encrypt/encrypted.yml', '1111')).deep.eq(
      await YamlUtils.loadYaml('test/encrypt/encrypted.yml', '1111'),
    );
    expect(CryptoUtils.encryptedCount(await YamlUtils.loadYaml('target/tests.encrypt/encrypted.yml', false))).eq(
      CryptoUtils.encryptedCount(await YamlUtils.loadYaml('test/encrypt/encrypted.yml', false)),
    );
  });

  it('password too short', async () => {
    fileSystemService.deleteFolder('target/tests.encrypt');
    await runCommand(
      'encrypt --source test/encrypt/plain.yml --destination target/tests.encrypt/encrypted.yml --password 1'.split(' '),
    ).catch((ctx) => {
      expect(ctx.message).to.contain('--password is invalid, Password must have at least 4 characters but got 1');
    });
  });

  it('already encrypted', async () => {
    fileSystemService.deleteFolder('target/tests.encrypt');
    await runCommand(
      'encrypt --source test/encrypt/encrypted.yml --destination target/tests.encrypt/encrypted.yml --password 1111'.split(' '),
    ).catch((ctx) => {
      expect(ctx.message).to.contain(
        'Source file test/encrypt/encrypted.yml is already encrypted. If you want to decrypt it use the decrypt command.',
      );
    });
  });

  it('same destination', async () => {
    fileSystemService.deleteFolder('target/tests.encrypt');
    await runCommand('encrypt --source test/encrypt/plain.yml --destination test/encrypt/plain.yml --password 1111'.split(' ')).catch(
      (ctx) => {
        expect(ctx.message).to.contain('Destination file test/encrypt/plain.yml already exists!');
      },
    );
  });
});
