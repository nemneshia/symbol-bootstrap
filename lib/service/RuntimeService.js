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
exports.RuntimeService = void 0;
const child_process_1 = require("child_process");
const util = require("util");
const OSUtils_1 = require("./OSUtils");
const Utils_1 = require("./Utils");
const exec = util.promisify(child_process_1.exec);
/**
 * Service in charge of running OS commands. Commands could be executed directly on the OS or via docker containers.
 */
class RuntimeService {
    constructor(logger) {
        this.logger = logger;
    }
    exec(runCommand, ignoreErrors) {
        this.logger.debug(`Exec command: ${runCommand}`);
        return exec(runCommand).catch((error) => {
            if (ignoreErrors)
                return { stdout: error.stdout, stderr: error.stderr };
            throw error;
        });
    }
    runImageUsingExec({ catapultAppFolder, image, userId, workdir, cmds, binds, ignoreErrors, }) {
        const volumes = binds.map((b) => `-v ${b}`).join(' ');
        const userParam = userId ? `-u ${userId}` : '';
        const workdirParam = workdir ? `--workdir=${workdir}` : '';
        const environmentParam = catapultAppFolder ? `--env LD_LIBRARY_PATH=${catapultAppFolder}/lib:${catapultAppFolder}/deps` : '';
        const commandLine = cmds.map((a) => `"${a}"`).join(' ');
        const runCommand = `docker run --rm ${userParam} ${workdirParam} ${environmentParam} ${volumes} ${image} ${commandLine}`;
        this.logger.info(Utils_1.Utils.secureString(`Running image using Exec: ${image} ${cmds.join(' ')}`));
        return this.exec(runCommand, ignoreErrors);
    }
    async spawn({ command, args, useLogger, logPrefix = '', shell }) {
        const cmd = (0, child_process_1.spawn)(command, args, { shell: shell });
        return new Promise((resolve, reject) => {
            this.logger.info(`Spawn command: ${command} ${args.join(' ')}`);
            let logText = useLogger ? '' : 'Check console for output....';
            const log = (data, isError) => {
                if (useLogger) {
                    logText = logText + `${data}\n`;
                    if (isError)
                        this.logger.warn(Utils_1.Utils.secureString(logPrefix + data));
                    else
                        this.logger.info(Utils_1.Utils.secureString(logPrefix + data));
                }
                else {
                    console.log(logPrefix + data);
                }
            };
            cmd.stdout.on('data', (data) => {
                log(`${data}`.trim(), false);
            });
            cmd.stderr.on('data', (data) => {
                log(`${data}`.trim(), true);
            });
            cmd.on('error', (error) => {
                log(`${error.message}`.trim(), true);
            });
            cmd.on('exit', (code, signal) => {
                if (code) {
                    log(`Process exited with code ${code} and signal ${signal}`, true);
                    reject(new Error(`Process exited with code ${code}\n${logText}`));
                }
                else {
                    resolve(logText);
                }
            });
            cmd.on('close', (code) => {
                if (code) {
                    log(`Process closed with code ${code}`, true);
                    reject(new Error(`Process closed with code ${code}\n${logText}`));
                }
                else {
                    resolve(logText);
                }
            });
            process.on('SIGINT', () => {
                resolve(logText);
            });
        });
    }
    async pullImage(image) {
        Utils_1.Utils.validateIsDefined(image, 'Image must be provided');
        if (RuntimeService.pulledImages.indexOf(image) > -1) {
            return;
        }
        try {
            this.logger.info(`Pulling image ${image}`);
            const stdout = await this.spawn({ command: 'docker', args: ['pull', image], useLogger: true, logPrefix: `${image} ` });
            const outputLines = stdout.toString().split('\n');
            this.logger.info(`Image pulled: ${outputLines[outputLines.length - 2]}`);
            RuntimeService.pulledImages.push(image);
        }
        catch (e) {
            this.logger.warn(`Image ${image} could not be pulled!`);
        }
    }
    async getDockerUserGroup() {
        const isWin = OSUtils_1.OSUtils.isWindows();
        if (isWin) {
            return undefined;
        }
        if (RuntimeService.dockerUserId !== undefined) {
            return RuntimeService.dockerUserId;
        }
        try {
            const userId = process === null || process === void 0 ? void 0 : process.getuid();
            const groupId = process === null || process === void 0 ? void 0 : process.getgid();
            const user = `${userId}:${groupId}`;
            this.logger.info(`User for docker resolved: ${user}`);
            if (userId === 0) {
                this.logger.error('YOU ARE RUNNING BOOTSTRAP AS ROOT!!!! THIS IS NOT RECOMMENDED!!!');
            }
            RuntimeService.dockerUserId = user;
            return user;
        }
        catch (e) {
            this.logger.info(`User for docker could not be resolved: ${e}`);
            return undefined;
        }
    }
    async resolveDockerUserFromParam(paramUser) {
        if (!paramUser || paramUser.trim() === '') {
            return undefined;
        }
        if (paramUser === RuntimeService.CURRENT_USER) {
            return this.getDockerUserGroup();
        }
        return paramUser;
    }
}
exports.RuntimeService = RuntimeService;
RuntimeService.pulledImages = [];
RuntimeService.CURRENT_USER = 'current';
