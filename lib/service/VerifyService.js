"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyService = exports.SudoRunVerifyAction = exports.DockerRunVerifyAction = exports.AppVersionVerifyAction = exports.AppVersionService = void 0;
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
const os = require("os");
const semver = require("semver");
const OSUtils_1 = require("./OSUtils");
const RuntimeService_1 = require("./RuntimeService");
const Utils_1 = require("./Utils");
const defaultExpectedVersions = {
    node: '12.0.0',
    docker: '18.3.0',
    dockerCompose: '1.25.0',
};
class AppVersionService {
    constructor(logger, runtimeService) {
        this.logger = logger;
        this.runtimeService = runtimeService;
    }
    loadVersion(text) {
        var _a;
        return (_a = text
            .replace(',', '')
            .split(' ')
            .map((word) => {
            const coerce = semver.coerce(word.trim(), AppVersionService.semverOptions);
            return coerce === null || coerce === void 0 ? void 0 : coerce.raw;
        })
            .find((a) => a)) === null || _a === void 0 ? void 0 : _a.trim();
    }
    async loadVersionFromCommand(command) {
        return this.loadVersion((await this.runtimeService.exec(command)).stdout.trim());
    }
    async verifyInstalledApp(versionLoader, header, minVersion, recommendationUrl) {
        const recommendationPrefix = `At least version ${minVersion} is required.`;
        const recommendationSuffix = `Check ${recommendationUrl}`;
        try {
            const version = await versionLoader();
            if (!version) {
                return {
                    header,
                    message: `Version could not be found! Output: ${versionLoader}`,
                    recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
                };
            }
            if (semver.lt(version, minVersion, AppVersionService.semverOptions)) {
                return {
                    header,
                    message: version,
                    recommendation: `${recommendationPrefix} Currently installed version is ${version}. ${recommendationSuffix}`,
                };
            }
            return { header, message: version };
        }
        catch (e) {
            return {
                header,
                message: `Error: ${Utils_1.Utils.getMessage(e)}`,
                recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
            };
        }
    }
}
exports.AppVersionService = AppVersionService;
AppVersionService.semverOptions = { loose: true };
class AppVersionVerifyAction {
    constructor(service, params) {
        this.service = service;
        this.params = params;
    }
    verify() {
        return this.service.verifyInstalledApp(async () => {
            if (this.params.version) {
                return this.params.version;
            }
            if (this.params.command) {
                return this.service.loadVersionFromCommand(this.params.command);
            }
            throw new Error('Either version or command must be provided!');
        }, this.params.header, this.params.expectedVersion, this.params.recommendationUrl);
    }
    shouldRun() {
        return true;
    }
}
exports.AppVersionVerifyAction = AppVersionVerifyAction;
class DockerRunVerifyAction {
    constructor(logger, runtimeService) {
        this.logger = logger;
        this.runtimeService = runtimeService;
    }
    async verify() {
        const header = 'Docker Run Test';
        const command = 'docker run hello-world';
        const recommendationUrl = `https://www.digitalocean.com/community/questions/how-to-fix-docker-got-permission-denied-while-trying-to-connect-to-the-docker-daemon-socket`;
        try {
            const output = (await this.runtimeService.exec(command)).stdout.trim();
            const expectedText = 'Hello from Docker!';
            if (output.indexOf(expectedText) == -1) {
                return {
                    header,
                    message: `Command '${command}' could not be executed: Error: '${expectedText}' not in output text \n${output}`,
                    recommendation: `Please check ${recommendationUrl}`,
                };
            }
            return { header, message: `Command '${command}' executed!` };
        }
        catch (e) {
            return {
                header,
                message: `Command '${command}' could not be executed: Error: ${Utils_1.Utils.getMessage(e)}`,
                recommendation: `Please check ${recommendationUrl}`,
            };
        }
    }
    shouldRun(lines) {
        return !!lines.find((l) => l.header === 'Docker Version' && !l.recommendation);
    }
}
exports.DockerRunVerifyAction = DockerRunVerifyAction;
class SudoRunVerifyAction {
    async verify() {
        const header = 'Sudo User Test';
        if (OSUtils_1.OSUtils.isRoot()) {
            return {
                header,
                message: `Your are running with the sudo user!`,
                recommendation: `Either don't use sudo or create a non sudo user to run Bootstrap.`,
            };
        }
        return { header, message: `Your are not the sudo user!` };
    }
    shouldRun() {
        return !OSUtils_1.OSUtils.isWindows();
    }
}
exports.SudoRunVerifyAction = SudoRunVerifyAction;
class VerifyService {
    constructor(logger, expectedVersions = {}) {
        this.logger = logger;
        this.actions = [];
        this.runtimeService = new RuntimeService_1.RuntimeService(logger);
        this.expectedVersions = Object.assign(Object.assign({}, defaultExpectedVersions), expectedVersions);
        const appVersionService = new AppVersionService(this.logger, this.runtimeService);
        this.actions.push(new AppVersionVerifyAction(appVersionService, {
            header: 'NodeVersion',
            version: VerifyService.currentNodeJsVersion,
            recommendationUrl: `https://nodejs.org/en/download/package-manager/`,
            expectedVersion: this.expectedVersions.node,
        }));
        this.actions.push(new AppVersionVerifyAction(appVersionService, {
            header: 'Docker Version',
            command: 'docker --version',
            recommendationUrl: `https://docs.docker.com/get-docker/`,
            expectedVersion: this.expectedVersions.docker,
        }));
        this.actions.push(new AppVersionVerifyAction(appVersionService, {
            header: 'Docker Compose Version',
            command: 'docker-compose --version',
            recommendationUrl: `https://docs.docker.com/compose/install/`,
            expectedVersion: this.expectedVersions.dockerCompose,
        }));
        this.actions.push(new DockerRunVerifyAction(this.logger, this.runtimeService));
        this.actions.push(new SudoRunVerifyAction());
    }
    async createReport() {
        const lines = [];
        const platform = `${os.type()} - ${os.release()} - ${os.platform()}`;
        for (const action of this.actions) {
            if (action.shouldRun(lines))
                lines.push(await action.verify());
        }
        return { lines, platform };
    }
    logReport(report) {
        this.logger.info(`OS: ${report.platform}`);
        report.lines.forEach((line) => {
            if (line.recommendation) {
                this.logger.error(`${line.header}  - Error! - ${line.message} - ${line.recommendation}`);
            }
            else {
                this.logger.info(`${line.header} - OK! - ${line.message}`);
            }
        });
    }
    validateReport(report) {
        const errors = report.lines.filter((r) => r.recommendation);
        if (errors.length) {
            throw new Error('There has been an error. Check the report:\n' +
                errors.map((line) => ` - ${line.header}  - Error! - ${line.message} - ${line.recommendation}`).join('\n'));
        }
    }
}
exports.VerifyService = VerifyService;
VerifyService.currentNodeJsVersion = process.versions.node;
