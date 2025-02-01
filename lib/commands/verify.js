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
const command_1 = require("@oclif/command");
const logger_1 = require("../logger");
const service_1 = require("../service");
class Verify extends command_1.Command {
    async run() {
        service_1.CommandUtils.showBanner();
        const { flags } = this.parse(Verify);
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        const service = new service_1.VerifyService(logger);
        const report = await service.createReport();
        service.logReport(report);
        service.validateReport(report);
    }
}
exports.default = Verify;
Verify.description = 'It tests the installed software in the current computer reporting if there is any missing dependency, invalid version, or software related issue.';
Verify.examples = [`$ symbol-bootstrap verify`];
Verify.flags = {
    help: service_1.CommandUtils.helpFlag,
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
