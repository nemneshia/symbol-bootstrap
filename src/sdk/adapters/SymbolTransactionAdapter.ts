import {
  AccountRoutesApi,
  ChainRoutesApi,
  Configuration,
  MosaicRoutesApi,
  NetworkRoutesApi,
  NodeRoutesApi,
  TransactionRoutesApi,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { Hash256, PrivateKey, PublicKey, utils } from 'symbol-sdk';
import {
  KeyPair,
  Network,
  SymbolFacade,
  SymbolTransactionFactory,
  models,
} from 'symbol-sdk/symbol';
import WebSocket from 'ws';

import type { Logger } from '../../logger/Logger.js';
import type { VotingKeyAccount } from '../../utils/VotingUtils.js';
import type { ITransactionPort } from '../ports/ITransactionPort.js';
import type { AccountInfoDto, NetworkConfigDto } from '../types/Network.js';
import type { AnnounceConfirmCallback, TransactionDescriptor } from '../types/Transaction.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildConfig(url: string): Configuration {
  return new Configuration({ basePath: url.replace(/\/$/, '') });
}

function networkByIdentifier(networkIdentifier: number): Network {
  if (networkIdentifier === 104) return Network.MAINNET;
  if (networkIdentifier === 152) return Network.TESTNET;
  // custom network – find by name or fall back to a fresh Network instance
  const known = Network.NETWORKS.find((n: Network) => n.identifier === networkIdentifier);
  if (known) return known;
  throw new Error(`不明なネットワーク識別子です: ${networkIdentifier}`);
}

/** Parse '7200s', '2h', '1h30m' style strings into seconds. */
function parseEpochAdjustment(raw: string): number {
  const trimmed = raw.trim().replace(/^PT/, '');
  let seconds = 0;
  const regex = /(\d+)([SMHDsmhd])/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    const value = parseInt(match[1], 10);
    switch (match[2].toUpperCase()) {
      case 'H':
        seconds += value * 3600;
        break;
      case 'M':
        seconds += value * 60;
        break;
      case 'S':
        seconds += value;
        break;
      case 'D':
        seconds += value * 86400;
        break;
    }
  }
  // fallback: plain integer
  if (seconds === 0) {
    const plain = parseInt(trimmed, 10);
    if (!isNaN(plain)) seconds = plain;
  }
  return seconds;
}

/** Strip '0x' or '0X' prefix and any single-quote separators from a mosaic id hex. */
function normalizeHexId(raw: string): string {
  return raw
    .replace(/^0[xX]/, '')
    .replace(/'/g, '')
    .toUpperCase()
    .padStart(16, '0');
}

/** Wait for the first WS confirmedAdded event whose hash matches. */
function waitForConfirmation(
  nodeUrl: string,
  address: string,
  txHash: string,
  timeoutMs = 120_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const wsUrl = nodeUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
    const ws = new WebSocket(wsUrl);
    let uid: string | undefined;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket confirmation timed out for tx ${txHash}`));
    }, timeoutMs);

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (!uid && msg['uid']) {
          uid = msg['uid'] as string;
          ws.send(
            JSON.stringify({
              uid,
              subscribe: `confirmedAdded/${address}`,
            })
          );
          return;
        }
        // Notification arrives as { topic: 'confirmedAdded/...', data: { meta: { hash: ... } } }
        const txData = (msg as any)?.data;
        const hash: string | undefined = txData?.meta?.hash ?? txData?.transaction?.meta?.hash;
        if (hash && hash.toUpperCase() === txHash.toUpperCase()) {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── adapter ──────────────────────────────────────────────────────────────────

export class SymbolTransactionAdapter implements ITransactionPort {
  // ── Network info ─────────────────────────────────────────────────────────

  async getNetworkConfig(url: string): Promise<NetworkConfigDto> {
    const cfg = buildConfig(url);
    const nodeApi = new NodeRoutesApi(cfg);
    const chainApi = new ChainRoutesApi(cfg);
    const networkApi = new NetworkRoutesApi(cfg);
    const mosaicApi = new MosaicRoutesApi(cfg);

    const [nodeInfo, chainInfo, networkProps, fees] = await Promise.all([
      nodeApi.getNodeInfo(),
      chainApi.getChainInfo(),
      networkApi.getNetworkProperties(),
      networkApi.getTransactionFees(),
    ]);

    const generationHashSeed: string = nodeInfo.networkGenerationHashSeed;
    const networkIdentifier: number = nodeInfo.networkIdentifier;

    const latestFinalizedBlockEpoch: number = chainInfo.latestFinalizedBlock.finalizationEpoch;
    const minFeeMultiplier: number = fees.minFeeMultiplier;

    const netPropsNetwork = networkProps.network;
    const epochAdjustmentRaw: string = netPropsNetwork?.epochAdjustment ?? '0s';
    const epochAdjustment: number = parseEpochAdjustment(epochAdjustmentRaw);

    // Currency mosaic id comes from chain properties
    const chain = networkProps.chain;
    const rawCurrencyMosaicId: string | undefined = chain?.currencyMosaicId;
    const currencyMosaicId = normalizeHexId(rawCurrencyMosaicId ?? '0');

    // Divisibility: fetch from mosaic info
    let currencyDivisibility = 6; // default
    try {
      const mosaicInfo = await mosaicApi.getMosaic({ mosaicId: currencyMosaicId });
      currencyDivisibility = mosaicInfo.mosaic?.divisibility ?? 6;
    } catch {
      // ignore – use default
    }

    return {
      epochAdjustment,
      currencyMosaicId,
      currencyDivisibility,
      minFeeMultiplier,
      generationHashSeed,
      latestFinalizedBlockEpoch,
      networkIdentifier,
    };
  }

  async getAccountInfo(url: string, address: string): Promise<AccountInfoDto | undefined> {
    const cfg = buildConfig(url);
    const accountApi = new AccountRoutesApi(cfg);
    try {
      const resp = await accountApi.getAccountInfo({ accountId: address });
      const accountDto = resp.account;
      const spk = accountDto.supplementalPublicKeys;
      return {
        address: accountDto.address,
        mosaics: accountDto.mosaics.map((m) => ({
          id: m.id,
          amount: BigInt(m.amount),
        })),
        supplementalPublicKeys: spk
          ? {
              linked: spk.linked?.publicKey,
              vrf: spk.vrf?.publicKey,
              voting: spk.voting?.publicKeys?.map((v: any) => ({
                publicKey: v.publicKey as string,
                startEpoch: v.startEpoch as number,
                endEpoch: v.endEpoch as number,
              })),
            }
          : undefined,
      };
    } catch (err: unknown) {
      // 404 means account does not exist on-chain
      const code = (err as any)?.response?.status ?? (err as any)?.status;
      if (code === 404) return undefined;
      throw err;
    }
  }

  // ── Deadline helper ───────────────────────────────────────────────────────

  computeDeadlineMs(networkConfig: NetworkConfigDto, durationSeconds = 7200): bigint {
    const epochMs = networkConfig.epochAdjustment * 1000;
    const nowMs = Date.now();
    const deadlineMs = nowMs - epochMs + durationSeconds * 1000;
    return BigInt(deadlineMs);
  }

  // ── Transaction descriptor builders ─────────────────────────────────────

  createVrfKeyLinkDescriptor(
    vrfPublicKey: string,
    action: 'link' | 'unlink',
    _signerPublicKey: string
  ): TransactionDescriptor {
    return {
      type: 'vrf_key_link_transaction_v1',
      linkedPublicKey: vrfPublicKey,
      linkAction: action === 'link' ? 'link' : 'unlink',
    };
  }

  createAccountKeyLinkDescriptor(
    remotePublicKey: string,
    action: 'link' | 'unlink',
    _signerPublicKey: string
  ): TransactionDescriptor {
    return {
      type: 'account_key_link_transaction_v1',
      linkedPublicKey: remotePublicKey,
      linkAction: action === 'link' ? 'link' : 'unlink',
    };
  }

  createVotingKeyLinkDescriptor(
    votingFile: VotingKeyAccount,
    action: 'link' | 'unlink',
    _signerPublicKey: string
  ): TransactionDescriptor {
    return {
      type: 'voting_key_link_transaction_v1',
      linkedPublicKey: votingFile.publicKey,
      startEpoch: votingFile.startEpoch,
      endEpoch: votingFile.endEpoch,
      linkAction: action === 'link' ? 'link' : 'unlink',
    };
  }

  createMultisigModificationDescriptor(
    additions: readonly string[],
    deletions: readonly string[],
    minApprovalDelta: number,
    minRemovalDelta: number,
    _signerPublicKey: string
  ): TransactionDescriptor {
    return {
      type: 'multisig_account_modification_transaction_v1',
      minApprovalDelta,
      minRemovalDelta,
      addressAdditions: additions,
      addressDeletions: deletions,
    };
  }

  createSelfTransferDescriptor(
    recipientAddress: string,
    currencyMosaicId: string,
    _signerPublicKey: string
  ): TransactionDescriptor {
    return {
      type: 'transfer_transaction_v1',
      recipientAddress,
      mosaics: [{ mosaicId: currencyMosaicId, amount: 0n }],
    };
  }

  isMultisigModification(descriptor: TransactionDescriptor): boolean {
    return descriptor.type === 'multisig_account_modification_transaction_v1';
  }

  // ── Nemesis-specific ─────────────────────────────────────────────────────

  buildSignedPayload(
    descriptor: TransactionDescriptor,
    signerPrivateKey: string,
    networkIdentifier: number,
    generationHashSeed: string
  ): string {
    const network = networkByIdentifier(networkIdentifier);
    const epochDate = (network.datetimeConverter as any).epoch as Date;
    const customNetwork = new Network(
      network.name,
      network.identifier,
      epochDate,
      new Hash256(utils.hexToUint8(generationHashSeed))
    );
    const facade = new SymbolFacade(customNetwork);
    const keyPair = new KeyPair(new PrivateKey(signerPrivateKey));

    const { type, ...rest } = descriptor;
    const tx = facade.transactionFactory.create({
      type,
      ...rest,
      signerPublicKey: keyPair.publicKey,
      // Nemesis transactions use minimal deadline/fee
      deadline: 1n,
      fee: 0n,
    });

    const signature = facade.signTransaction(keyPair, tx);
    const jsonPayload = SymbolTransactionFactory.attachSignature(tx, signature);
    const parsed = JSON.parse(jsonPayload) as { payload: string };
    return parsed.payload;
  }

  computeTransactionHash(
    hexPayload: string,
    generationHashSeed: string,
    networkIdentifier: number
  ): string {
    const network = networkByIdentifier(networkIdentifier);
    const epochDate = (network.datetimeConverter as any).epoch as Date;
    const customNetwork = new Network(
      network.name,
      network.identifier,
      epochDate,
      new Hash256(utils.hexToUint8(generationHashSeed))
    );
    const facade = new SymbolFacade(customNetwork);
    const txBytes = utils.hexToUint8(hexPayload);
    const tx = SymbolTransactionFactory.deserialize(txBytes);
    const hash = facade.hashTransaction(tx);
    return utils.uint8ToHex(hash.bytes);
  }

  // ── Announce flows ────────────────────────────────────────────────────────

  async announceSimple(
    descriptor: TransactionDescriptor,
    signerPrivateKey: string,
    networkConfig: NetworkConfigDto,
    url: string,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean> {
    const { facade, keyPair } = this._createFacadeAndKeyPair(signerPrivateKey, networkConfig);
    const tx = this._buildTx(facade, descriptor, keyPair.publicKey, networkConfig, providedMaxFee);
    const description = this._describeTx(descriptor, networkConfig);
    if (!(await confirmFn(description))) return false;

    const signature = facade.signTransaction(keyPair, tx);
    SymbolTransactionFactory.attachSignature(tx, signature);
    const hash = utils.uint8ToHex(facade.hashTransaction(tx).bytes);
    logger.info(`トランザクション ${hash} をアナウンスします`);

    await this._announce(url, tx);
    const address = utils.uint8ToHex(facade.network.publicKeyToAddress(keyPair.publicKey).bytes);
    await waitForConfirmation(url, address, hash);
    logger.info(`トランザクション ${hash} の承認を確認しました`);
    return true;
  }

  async announceAggregateComplete(
    descriptors: readonly TransactionDescriptor[],
    mainPublicKey: string,
    signerPrivateKey: string,
    cosignerPrivateKeys: readonly string[],
    networkConfig: NetworkConfigDto,
    url: string,
    _requiredCosignatures: number,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean> {
    const { facade, keyPair } = this._createFacadeAndKeyPair(signerPrivateKey, networkConfig);
    const mainPubKey = new PublicKey(mainPublicKey);

    const embeddedTxs = descriptors.map((d) => {
      const { type, ...rest } = d;
      return facade.transactionFactory.createEmbedded({
        type,
        ...rest,
        signerPublicKey: mainPubKey,
      });
    });

    const deadline = this.computeDeadlineMs(networkConfig);
    const txsHash = SymbolFacade.hashEmbeddedTransactions(embeddedTxs);

    const aggregateTx = facade.transactionFactory.create({
      type: 'aggregate_complete_transaction_v3',
      signerPublicKey: keyPair.publicKey,
      deadline,
      transactionsHash: txsHash,
      transactions: embeddedTxs,
    }) as models.AggregateCompleteTransactionV3;

    // Set fee
    const cosignatureCount = cosignerPrivateKeys.length;
    const feeMultiplier =
      providedMaxFee !== undefined ? providedMaxFee : networkConfig.minFeeMultiplier;
    const txSize = aggregateTx.size + cosignatureCount * new models.Cosignature().size;
    aggregateTx.fee = new models.Amount(BigInt(txSize) * BigInt(feeMultiplier));

    const description = `Aggregate complete with ${descriptors.length} inner tx(s)`;
    if (!(await confirmFn(description))) return false;

    const signature = facade.signTransaction(keyPair, aggregateTx);
    SymbolTransactionFactory.attachSignature(aggregateTx, signature);

    // Cosignatories
    const aggHash = facade.hashTransaction(aggregateTx);
    for (const cosignerKey of cosignerPrivateKeys) {
      const cosignKeyPair = new KeyPair(new PrivateKey(cosignerKey));
      const cosignature = SymbolFacade.cosignTransactionHash(cosignKeyPair, aggHash);
      aggregateTx.cosignatures.push(cosignature as models.Cosignature);
    }

    const hash = utils.uint8ToHex(aggHash.bytes);
    logger.info(`アグリゲートコンプリートトランザクション ${hash} をアナウンスします`);
    await this._announce(url, aggregateTx);
    const address = utils.uint8ToHex(facade.network.publicKeyToAddress(keyPair.publicKey).bytes);
    await waitForConfirmation(url, address, hash);
    logger.info(`アグリゲートコンプリートトランザクション ${hash} の承認を確認しました`);
    return true;
  }

  async announceAggregateBonded(
    descriptors: readonly TransactionDescriptor[],
    mainPublicKey: string,
    signerPrivateKey: string,
    cosignerPrivateKeys: readonly string[],
    _requiredCosignatures: number,
    networkConfig: NetworkConfigDto,
    url: string,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean> {
    const { facade, keyPair } = this._createFacadeAndKeyPair(signerPrivateKey, networkConfig);
    const mainPubKey = new PublicKey(mainPublicKey);

    const embeddedTxs = descriptors.map((d) => {
      const { type, ...rest } = d;
      return facade.transactionFactory.createEmbedded({
        type,
        ...rest,
        signerPublicKey: mainPubKey,
      });
    });

    const deadline = this.computeDeadlineMs(networkConfig);
    const feeMultiplier =
      providedMaxFee !== undefined ? providedMaxFee : networkConfig.minFeeMultiplier;
    const txsHash = SymbolFacade.hashEmbeddedTransactions(embeddedTxs);

    const bondedTx = facade.transactionFactory.create({
      type: 'aggregate_bonded_transaction_v3',
      signerPublicKey: keyPair.publicKey,
      deadline,
      transactionsHash: txsHash,
      transactions: embeddedTxs,
    }) as models.AggregateBondedTransactionV3;

    const cosignatureCount = cosignerPrivateKeys.length;
    const bondedSize = bondedTx.size + cosignatureCount * new models.Cosignature().size;
    bondedTx.fee = new models.Amount(BigInt(bondedSize) * BigInt(feeMultiplier));

    // Build hash-lock (10 XYM, 5760 blocks)
    const bondedHash = facade.hashTransaction(bondedTx);
    const hashLockAmount = BigInt(10) * BigInt(10 ** networkConfig.currencyDivisibility);
    const hashLockTx = facade.transactionFactory.create({
      type: 'hash_lock_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      deadline,
      mosaic: { mosaicId: networkConfig.currencyMosaicId, amount: hashLockAmount },
      duration: 5760n,
      hash: bondedHash,
    });
    hashLockTx.fee = new models.Amount(BigInt(hashLockTx.size) * BigInt(feeMultiplier));

    const description = `Aggregate bonded with ${descriptors.length} inner tx(s) (needs hash-lock)`;
    if (!(await confirmFn(description))) return false;

    // Sign hash lock
    const hashLockSig = facade.signTransaction(keyPair, hashLockTx);
    SymbolTransactionFactory.attachSignature(hashLockTx, hashLockSig);
    const lockHash = utils.uint8ToHex(facade.hashTransaction(hashLockTx).bytes);
    const signerAddress = utils.uint8ToHex(
      facade.network.publicKeyToAddress(keyPair.publicKey).bytes
    );

    logger.info(`ハッシュロックトランザクション ${lockHash} をアナウンスします`);
    await this._announce(url, hashLockTx);
    await waitForConfirmation(url, signerAddress, lockHash);
    logger.info('ハッシュロックの承認を確認しました。アグリゲートボンデッドをアナウンスします...');

    // Sign bonded
    const bondedSig = facade.signTransaction(keyPair, bondedTx);
    SymbolTransactionFactory.attachSignature(bondedTx, bondedSig);

    // Cosignatories
    for (const cosignerKey of cosignerPrivateKeys) {
      const cosignKeyPair = new KeyPair(new PrivateKey(cosignerKey));
      const cosignature = SymbolFacade.cosignTransactionHash(cosignKeyPair, bondedHash);
      bondedTx.cosignatures.push(cosignature as models.Cosignature);
    }

    const bondedHashHex = utils.uint8ToHex(bondedHash.bytes);
    logger.info(`アグリゲートボンデッドトランザクション ${bondedHashHex} をアナウンスします`);
    await this._announcePartial(url, bondedTx);
    await waitForConfirmation(url, signerAddress, bondedHashHex);
    logger.info(`アグリゲートボンデッドトランザクション ${bondedHashHex} の承認を確認しました`);
    return true;
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private _createFacadeAndKeyPair(signerPrivateKey: string, networkConfig: NetworkConfigDto) {
    const network = networkByIdentifier(networkConfig.networkIdentifier);
    const epochDate = (network.datetimeConverter as any).epoch as Date;
    const customNetwork = new Network(
      network.name,
      network.identifier,
      epochDate,
      new Hash256(utils.hexToUint8(networkConfig.generationHashSeed))
    );
    const facade = new SymbolFacade(customNetwork);
    const keyPair = new KeyPair(new PrivateKey(signerPrivateKey));
    return { facade, keyPair };
  }

  private _buildTx(
    facade: SymbolFacade,
    descriptor: TransactionDescriptor,
    signerPublicKey: PublicKey,
    networkConfig: NetworkConfigDto,
    providedMaxFee: number | undefined
  ) {
    const deadline = this.computeDeadlineMs(networkConfig);
    const { type, ...rest } = descriptor;
    const tx = facade.transactionFactory.create({
      type,
      ...rest,
      signerPublicKey,
      deadline,
      fee: 0n,
    });
    const feeMultiplier =
      providedMaxFee !== undefined ? providedMaxFee : networkConfig.minFeeMultiplier;
    tx.fee = new models.Amount(BigInt(tx.size) * BigInt(feeMultiplier));
    return tx;
  }

  private _describeTx(descriptor: TransactionDescriptor, _networkConfig: NetworkConfigDto): string {
    return `Transaction type: ${descriptor.type}`;
  }

  private async _announce(url: string, tx: models.Transaction): Promise<void> {
    const cfg = buildConfig(url);
    const txApi = new TransactionRoutesApi(cfg);
    const hexPayload = utils.uint8ToHex(tx.serialize());
    await txApi.announceTransaction({ transactionPayload: { payload: hexPayload } });
  }

  private async _announcePartial(url: string, tx: models.Transaction): Promise<void> {
    const cfg = buildConfig(url);
    const txApi = new TransactionRoutesApi(cfg);
    const hexPayload = utils.uint8ToHex(tx.serialize());
    await txApi.announcePartialTransaction({ transactionPayload: { payload: hexPayload } });
  }
}
