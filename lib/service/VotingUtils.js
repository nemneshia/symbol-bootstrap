"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingUtils = void 0;
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
const noble = require("@noble/ed25519");
const fs_1 = require("fs");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const nacl = require("tweetnacl");
class VotingUtils {
    constructor(implementation = VotingUtils.nobleImplementation) {
        this.implementation = implementation;
    }
    insert(result, value, index) {
        result.set(value, index);
        return index + value.length;
    }
    async createVotingFile(secret, votingKeyStartEpoch, votingKeyEndEpoch, unitTestPrivateKeys = undefined) {
        const items = votingKeyEndEpoch - votingKeyStartEpoch + 1;
        const headerSize = 64 + 16;
        const itemSize = 32 + 64;
        const totalSize = headerSize + items * itemSize;
        const rootPrivateKey = await this.implementation.createKeyPairFromPrivateKey(symbol_sdk_1.Convert.hexToUint8(secret));
        const result = new Uint8Array(totalSize);
        //start-epoch (8b),
        let index = 0;
        index = this.insert(result, symbol_sdk_1.Convert.numberToUint8Array(votingKeyStartEpoch, 8), index);
        //end-epoch (8b),
        index = this.insert(result, symbol_sdk_1.Convert.numberToUint8Array(votingKeyEndEpoch, 8), index);
        // could it have other values????
        //last key identifier (8b) - for fresh file this is 0xFFFF'FFFF'FFFF'FFFF (a.k.a. Invalid_Id)
        index = this.insert(result, symbol_sdk_1.Convert.hexToUint8('FFFFFFFFFFFFFFFF'), index);
        //last wipe key identifier (8b) - again, for fresh file this is 0xFFFF'FFFF'FFFF'FFFF (Invalid_Id)
        index = this.insert(result, symbol_sdk_1.Convert.hexToUint8('FFFFFFFFFFFFFFFF'), index);
        // root public key (32b) - this is root public key that is getting announced via vote link tx
        index = this.insert(result, rootPrivateKey.publicKey, index);
        // start-epoch (8b), \ those two are exactly same one, as top level, reason is this was earlier a tree,
        index = this.insert(result, symbol_sdk_1.Convert.numberToUint8Array(votingKeyStartEpoch, 8), index);
        //end-epoch (8b), / and each level holds this separately, so we left it as is
        index = this.insert(result, symbol_sdk_1.Convert.numberToUint8Array(votingKeyEndEpoch, 8), index);
        /// what follows are bound keys, there are (end - start + 1) of them.
        // each key is:
        for (let i = 0; i < items; i++) {
            // random PRIVATE key (32b)
            const randomPrivateKey = unitTestPrivateKeys ? unitTestPrivateKeys[i] : symbol_sdk_1.Crypto.randomBytes(32);
            if (randomPrivateKey.length != 32) {
                throw new Error(`Invalid private key size ${randomPrivateKey.length}!`);
            }
            const randomKeyPar = await this.implementation.createKeyPairFromPrivateKey(randomPrivateKey);
            index = this.insert(result, randomPrivateKey, index);
            // signature (64b)
            // now the signature is usual signature done using ROOT private key on a following data:
            //   (public key (32b), identifier (8b))
            //
            //   identifier is simply epoch, but, most importantly keys are written in REVERSE order.
            //
            //   i.e. say your start-epoch = 2, end-epoch = 42
            const identifier = symbol_sdk_1.Convert.numberToUint8Array(votingKeyEndEpoch - i, 8);
            const signature = await this.implementation.sign(rootPrivateKey, Uint8Array.from([...randomKeyPar.publicKey, ...identifier]));
            index = this.insert(result, signature, index);
        }
        //
        // root private key is discarded after file is created.
        // header:
        //   2, 42, ff.., ff..., (root pub), 2, 42
        // keys:
        //   (priv key 42, sig 42), (priv key 41, sig 31), ..., (priv key 2, sig 2)
        //
        // every priv key should be cryptographically random,
        return result;
    }
    readVotingFile(file) {
        //start-epoch (8b),
        const votingKeyStartEpoch = symbol_sdk_1.Convert.uintArray8ToNumber(file.slice(0, 8));
        //end-epoch (8b),
        const votingKeyEndEpoch = symbol_sdk_1.Convert.uintArray8ToNumber(file.slice(8, 16));
        const votingPublicKey = symbol_sdk_1.Convert.uint8ToHex(file.slice(32, 64));
        const items = votingKeyEndEpoch - votingKeyStartEpoch + 1;
        const headerSize = 64 + 16;
        const itemSize = 32 + 64;
        const totalSize = headerSize + items * itemSize;
        if (file.length != totalSize) {
            throw new Error(`Unexpected voting key file. Expected ${totalSize} but got ${file.length}`);
        }
        return {
            publicKey: votingPublicKey,
            startEpoch: votingKeyStartEpoch,
            endEpoch: votingKeyEndEpoch,
        };
    }
    loadVotingFiles(folder) {
        if (!(0, fs_1.existsSync)(folder)) {
            return [];
        }
        return (0, fs_1.readdirSync)(folder)
            .map((filename) => {
            const currentPath = (0, path_1.join)(folder, filename);
            if ((0, fs_1.lstatSync)(currentPath).isFile() && filename.startsWith('private_key_tree') && filename.endsWith('.dat')) {
                return Object.assign(Object.assign({}, this.readVotingFile((0, fs_1.readFileSync)(currentPath))), { filename });
            }
            else {
                return undefined;
            }
        })
            .filter((i) => i)
            .map((i) => i)
            .sort((a, b) => a.startEpoch - b.startEpoch);
    }
}
exports.VotingUtils = VotingUtils;
_a = VotingUtils;
VotingUtils.nobleImplementation = {
    name: 'Noble',
    createKeyPairFromPrivateKey: async (privateKey) => {
        const publicKey = await noble.getPublicKey(privateKey);
        return { privateKey, publicKey: publicKey };
    },
    sign: async (keyPair, data) => {
        return await noble.sign(data, keyPair.privateKey);
    },
};
VotingUtils.tweetNaClImplementation = {
    name: 'TweetNaCl',
    createKeyPairFromPrivateKey: async (privateKey) => {
        const { publicKey } = nacl.sign.keyPair.fromSeed(privateKey);
        return { privateKey, publicKey };
    },
    sign: async (keyPair, data) => {
        const secretKey = new Uint8Array(64);
        secretKey.set(keyPair.privateKey);
        secretKey.set(keyPair.publicKey, 32);
        return nacl.sign.detached(data, secretKey);
    },
};
VotingUtils.implementations = [VotingUtils.nobleImplementation, VotingUtils.tweetNaClImplementation];
