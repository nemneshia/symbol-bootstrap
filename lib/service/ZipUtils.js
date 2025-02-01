"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZipUtils = void 0;
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
const archiver = require("archiver");
const fs_1 = require("fs");
const StreamZip = require("node-stream-zip");
const AsyncUtils_1 = require("./AsyncUtils");
const Utils_1 = require("./Utils");
class ZipUtils {
    constructor(logger) {
        this.logger = logger;
    }
    async zip(destination, items) {
        const output = (0, fs_1.createWriteStream)(destination);
        const archive = archiver('zip', {
            zlib: { level: 9 }, // Sets the compression level.
        });
        archive.pipe(output);
        return new Promise(async (resolve, reject) => {
            output.on('close', () => {
                this.logger.info('');
                this.logger.info(`Zip file ${destination} size ${Math.floor(archive.pointer() / 1024)} KB has been created.`);
                resolve();
            });
            output.on('end', () => {
                this.logger.info('');
                this.logger.info('Data has been drained');
            });
            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on('warning', (err) => {
                this.logger.info('');
                if (err.code === 'ENOENT') {
                    // log warning
                    this.logger.info(`There has been an warning creating ZIP file '${destination}' ${err.message || err}`);
                }
                else {
                    // throw error
                    this.logger.info(`There has been an error creating ZIP file '${destination}' ${err.message || err}`);
                    reject(err);
                }
            });
            // good practice to catch this error explicitly
            archive.on('error', (err) => {
                this.logger.info(`There has been an error creating ZIP file '${destination}' ${err.message || err}`);
                reject(err);
            });
            for (const item of items) {
                if (item.directory) {
                    archive.directory(item.from, item.to || false, (entry) => {
                        var _a;
                        if ((_a = item.blacklist) === null || _a === void 0 ? void 0 : _a.find((s) => entry.name === s)) {
                            return false;
                        }
                        return entry;
                    });
                }
                else {
                    archive.file(item.from, { name: item.to });
                }
            }
            archive.on('progress', (progress) => {
                const message = `${progress.entries.processed} entries zipped!`;
                Utils_1.Utils.logSameLineMessage(message);
            });
            await archive.finalize();
        });
    }
    unzip(zipFile, innerFolder, targetFolder) {
        const zip = new StreamZip({
            file: zipFile,
            storeEntries: true,
        });
        this.logger.info(`Unzipping Backup Sync's '${innerFolder || 'ROOT'}' into '${targetFolder}'. This could take a while!`);
        let totalFiles = 0;
        let process = 0;
        return new Promise((resolve, reject) => {
            zip.on('entry', (entry) => {
                if (!entry.isDirectory && totalFiles) {
                    process++;
                    const percentage = ((process * 100) / totalFiles).toFixed(2);
                    const message = `${percentage}% | ${process} files unzipped out of ${totalFiles}`;
                    Utils_1.Utils.logSameLineMessage(message);
                }
                if (AsyncUtils_1.AsyncUtils.stopProcess) {
                    zip.close();
                    reject(new Error('Process cancelled!'));
                }
            });
            zip.on('ready', () => {
                totalFiles = zip.entriesCount;
                zip.extract(innerFolder, targetFolder, (err) => {
                    zip.close();
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.logger.info(`Unzipped '${targetFolder}' created`);
                        resolve();
                    }
                });
            });
        });
    }
}
exports.ZipUtils = ZipUtils;
