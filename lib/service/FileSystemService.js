"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemService = void 0;
const fs_1 = require("fs");
const https_1 = require("https");
const path_1 = require("path");
const Constants_1 = require("./Constants");
const KnownError_1 = require("./KnownError");
const Utils_1 = require("./Utils");
/**
 * Service handling files and how to store and load them on the file system.
 */
class FileSystemService {
    constructor(logger) {
        this.logger = logger;
    }
    validateFolder(workingDirFullPath) {
        if (!(0, fs_1.existsSync)(workingDirFullPath)) {
            throw new Error(`${workingDirFullPath} folder does not exist`);
        }
        if (!(0, fs_1.lstatSync)(workingDirFullPath).isDirectory()) {
            throw new Error(`${workingDirFullPath} is not a folder!`);
        }
    }
    validateSeedFolder(nemesisSeedFolder, message) {
        this.validateFolder(nemesisSeedFolder);
        const seedData = (0, path_1.join)(nemesisSeedFolder, '00000', '00001.dat');
        if (!(0, fs_1.existsSync)(seedData)) {
            throw new KnownError_1.KnownError(`File ${seedData} doesn't exist! ${message}`);
        }
        const seedIndex = (0, path_1.join)(nemesisSeedFolder, 'index.dat');
        if (!(0, fs_1.existsSync)(seedIndex)) {
            throw new KnownError_1.KnownError(`File ${seedIndex} doesn't exist! ${message}`);
        }
    }
    deleteFile(file) {
        if ((0, fs_1.existsSync)(file) && (0, fs_1.lstatSync)(file).isFile()) {
            (0, fs_1.unlinkSync)(file);
        }
    }
    async mkdir(path) {
        await fs_1.promises.mkdir(path, { recursive: true });
    }
    async mkdirParentFolder(fileName) {
        const parentFolder = (0, path_1.dirname)(fileName);
        if (parentFolder) {
            return this.mkdir(parentFolder);
        }
    }
    async copyDir(copyFrom, copyTo, excludeFiles = [], includeFiles = []) {
        await this.mkdir(copyTo);
        const files = await fs_1.promises.readdir(copyFrom);
        await Promise.all(files.map(async (file) => {
            const fromPath = (0, path_1.join)(copyFrom, file);
            const toPath = (0, path_1.join)(copyTo, file);
            // Stat the file to see if we have a file or dir
            const stat = await fs_1.promises.stat(fromPath);
            if (stat.isFile()) {
                const fileName = (0, path_1.basename)(toPath);
                const notBlacklisted = excludeFiles.indexOf(fileName) === -1;
                const inWhitelistIfAny = includeFiles.length === 0 || includeFiles.indexOf(fileName) > -1;
                if (notBlacklisted && inWhitelistIfAny) {
                    await fs_1.promises.copyFile(fromPath, toPath);
                }
            }
            else if (stat.isDirectory()) {
                await this.mkdir(toPath);
                await this.copyDir(fromPath, toPath, excludeFiles, includeFiles);
            }
        }));
    }
    deleteFolder(folder, excludeFiles = []) {
        if ((0, fs_1.existsSync)(folder)) {
            this.logger.info(`Deleting folder ${folder}`);
        }
        return this.deleteFolderRecursive(folder, excludeFiles);
    }
    deleteFolderRecursive(folder, excludeFiles = []) {
        if ((0, fs_1.existsSync)(folder)) {
            (0, fs_1.readdirSync)(folder).forEach((file) => {
                const currentPath = (0, path_1.join)(folder, file);
                if (excludeFiles.find((f) => f === currentPath)) {
                    this.logger.info(`File ${currentPath} excluded from deletion.`);
                    return;
                }
                if ((0, fs_1.lstatSync)(currentPath).isDirectory()) {
                    // recurse
                    this.deleteFolderRecursive(currentPath, excludeFiles.map((file) => (0, path_1.join)(currentPath, file)));
                }
                else {
                    // delete file
                    (0, fs_1.unlinkSync)(currentPath);
                }
            });
            if (!(0, fs_1.readdirSync)(folder).length)
                (0, fs_1.rmdirSync)(folder);
        }
    }
    getFilesRecursively(originalPath) {
        const isDirectory = (path) => (0, fs_1.statSync)(path).isDirectory();
        const getDirectories = (path) => (0, fs_1.readdirSync)(path)
            .map((name) => (0, path_1.join)(path, name))
            .filter(isDirectory);
        const isFile = (path) => (0, fs_1.statSync)(path).isFile();
        const getFiles = (path) => (0, fs_1.readdirSync)(path)
            .map((name) => (0, path_1.join)(path, name))
            .filter(isFile);
        const dirs = getDirectories(originalPath);
        const files = dirs
            .map((dir) => this.getFilesRecursively(dir)) // go through each directory
            .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten
        return files.concat(getFiles(originalPath));
    }
    getTargetFolder(target, absolute, ...paths) {
        if (absolute) {
            return (0, path_1.join)(process.cwd(), target, ...paths);
        }
        else {
            return (0, path_1.join)(target, ...paths);
        }
    }
    getTargetNodesFolder(target, absolute, ...paths) {
        return this.getTargetFolder(target, absolute, Constants_1.Constants.targetNodesFolder, ...paths);
    }
    getTargetGatewayFolder(target, absolute, ...paths) {
        return this.getTargetFolder(target, absolute, Constants_1.Constants.targetGatewaysFolder, ...paths);
    }
    getTargetNemesisFolder(target, absolute, ...paths) {
        return this.getTargetFolder(target, absolute, Constants_1.Constants.targetNemesisFolder, ...paths);
    }
    getTargetDatabasesFolder(target, absolute, ...paths) {
        return this.getTargetFolder(target, absolute, Constants_1.Constants.targetDatabasesFolder, ...paths);
    }
    async download(url, dest) {
        const destinationSize = (0, fs_1.existsSync)(dest) ? (0, fs_1.statSync)(dest).size : -1;
        const isHttpRequest = url.toLowerCase().startsWith('https:') || url.toLowerCase().startsWith('http:');
        if (!isHttpRequest) {
            const stats = (0, fs_1.statSync)(url);
            if ((0, fs_1.existsSync)(url) && !stats.isDirectory()) {
                return {
                    downloaded: false,
                    fileLocation: url,
                };
            }
            else {
                throw new Error(`Local file ${url} does not exist`);
            }
        }
        else {
            this.logger.info(`Checking remote file ${url}`);
            return new Promise((resolve, reject) => {
                function showDownloadingProgress(received, total) {
                    const percentage = ((received * 100) / total).toFixed(2);
                    const message = percentage + '% | ' + received + ' bytes downloaded out of ' + total + ' bytes.';
                    Utils_1.Utils.logSameLineMessage(message);
                }
                const request = (0, https_1.get)(url, (response) => {
                    const total = parseInt(response.headers['content-length'] || '0', 10);
                    let received = 0;
                    if (total === destinationSize) {
                        this.logger.info(`File ${dest} is up to date with url ${url}. No need to download!`);
                        request.abort();
                        resolve({
                            downloaded: false,
                            fileLocation: dest,
                        });
                    }
                    else if (response.statusCode === 200) {
                        (0, fs_1.existsSync)(dest) && (0, fs_1.unlinkSync)(dest);
                        const file = (0, fs_1.createWriteStream)(dest, { flags: 'wx' });
                        this.logger.info(`Downloading file ${url}. This could take a while!`);
                        response.pipe(file);
                        response.on('data', function (chunk) {
                            received += chunk.length;
                            showDownloadingProgress(received, total);
                        });
                        file.on('finish', () => {
                            resolve({
                                downloaded: true,
                                fileLocation: dest,
                            });
                        });
                        file.on('error', (err) => {
                            file.close();
                            if (err.code === 'EEXIST') {
                                reject(new Error('File already exists'));
                            }
                            else {
                                (0, fs_1.unlinkSync)(dest); // Delete temp file
                                reject(err);
                            }
                        });
                    }
                    else {
                        reject(new Error(`Server responded with ${response.statusCode} ${response.statusMessage || ''}`.trim()));
                    }
                });
                request.on('error', (err) => {
                    (0, fs_1.existsSync)(dest) && (0, fs_1.unlinkSync)(dest); // Delete temp file
                    reject(err.message);
                });
            });
        }
    }
    async chmodRecursive(path, mode) {
        // Loop through all the files in the config folder
        const stat = await fs_1.promises.stat(path);
        if (stat.isFile()) {
            await fs_1.promises.chmod(path, mode);
        }
        else if (stat.isDirectory()) {
            const files = await fs_1.promises.readdir(path);
            await Promise.all(files.map(async (file) => {
                await this.chmodRecursive((0, path_1.join)(path, file), mode);
            }));
        }
    }
}
exports.FileSystemService = FileSystemService;
