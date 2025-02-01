"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NemgenService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const Constants_1 = require("./Constants");
const FileSystemService_1 = require("./FileSystemService");
const RuntimeService_1 = require("./RuntimeService");
class NemgenService {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
        this.runtimeService = new RuntimeService_1.RuntimeService(logger);
        this.fileSystemService = new FileSystemService_1.FileSystemService(logger);
    }
    async run(presetData) {
        const networkIdentifier = presetData.networkIdentifier;
        const symbolServerImage = presetData.symbolServerImage;
        const target = this.params.target;
        if (!presetData.nodes || !presetData.nodes.length) {
            throw new Error('Nodes must be defined in preset when running nemgen');
        }
        const nemesisWorkingDir = this.fileSystemService.getTargetNemesisFolder(target, true);
        const nemesisSeedFolder = (0, path_1.join)(nemesisWorkingDir, `seed`, networkIdentifier, `0000`);
        await this.fileSystemService.mkdir(nemesisSeedFolder);
        await fs_1.promises.copyFile((0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, `config`, `hashes.dat`), (0, path_1.join)(nemesisSeedFolder, `hashes.dat`));
        const name = presetData.nodes[0].name;
        const serverConfigWorkingDir = this.fileSystemService.getTargetNodesFolder(target, true, name, 'server-config');
        this.fileSystemService.validateFolder(nemesisWorkingDir);
        this.fileSystemService.validateFolder(serverConfigWorkingDir);
        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.nemgen`,
            '--resources=/server-config',
            '--nemesisProperties=./server-config/block-properties-file.properties',
            '--useTemporaryCacheDatabase',
        ];
        const binds = [`${serverConfigWorkingDir}:/server-config`, `${nemesisWorkingDir}:/nemesis`];
        const userId = await this.runtimeService.resolveDockerUserFromParam(this.params.user);
        let stdout;
        let stderr;
        let message;
        let failed;
        try {
            ({ stdout, stderr } = await this.runtimeService.runImageUsingExec({
                catapultAppFolder: presetData.catapultAppFolder,
                image: symbolServerImage,
                userId: userId,
                workdir: '/nemesis',
                cmds: cmd,
                binds: binds,
            }));
            failed = stdout.indexOf('<error>') > -1;
        }
        catch (e) {
            failed = true;
            ({ stdout, stderr, message } = e);
        }
        if (failed) {
            if (message)
                this.logger.error(message);
            if (stdout)
                this.logger.info(stdout);
            if (stderr)
                this.logger.error(stderr);
            throw new Error('Nemgen failed. Check the logs!');
        }
        this.fileSystemService.deleteFolder((0, path_1.join)(nemesisWorkingDir, `seed`, networkIdentifier));
        this.logger.info('Nemgen executed!!!!');
    }
}
exports.NemgenService = NemgenService;
