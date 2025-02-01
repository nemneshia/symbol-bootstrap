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
exports.LoggerFactory = void 0;
const path_1 = require("path");
const winston = require("winston");
const service_1 = require("../service");
const LogType_1 = require("./LogType");
class LoggerFactory {
    static getLogger(logTypes, workingDir = service_1.Constants.defaultWorkingDir) {
        return this.getLoggerFromTypes(logTypes
            .split(LoggerFactory.separator)
            .map((l) => l.trim())
            .filter((t) => t), workingDir);
    }
    static getLoggerFromTypes(logTypes, workingDir = service_1.Constants.defaultWorkingDir) {
        const id = logTypes.join(LoggerFactory.separator);
        if (!winston.loggers.has(id)) {
            const transports = logTypes.map((logType) => {
                switch (logType.toLowerCase()) {
                    case LogType_1.LogType.File.toLowerCase():
                        return LoggerFactory.fileTransport((0, path_1.join)(workingDir, 'logs.log'));
                    case LogType_1.LogType.Console.toLowerCase():
                        return LoggerFactory.consoleTransport;
                    case LogType_1.LogType.Silent.toLowerCase():
                        return LoggerFactory.silent;
                    default:
                        throw new Error(`Unknown LogType ${logType}`);
                }
            });
            winston.loggers.add(id, {
                transports: transports,
                format: winston.format.label({ label: id }),
            });
        }
        return winston.loggers.get(id);
    }
}
exports.LoggerFactory = LoggerFactory;
LoggerFactory.separator = ',';
LoggerFactory.consoleTransport = new winston.transports.Console({
    format: winston.format.combine(winston.format.timestamp(), winston.format.cli(), winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`)),
});
LoggerFactory.silent = new winston.transports.Console({
    silent: true,
});
LoggerFactory.fileTransport = (fileName) => new winston.transports.File({
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`)),
    options: { flags: 'w' },
    filename: (0, path_1.resolve)(fileName),
    level: 'info',
});
