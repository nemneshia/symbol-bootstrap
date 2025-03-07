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

import { expect } from 'chai';
import { of } from 'rxjs';
import { match, restore, spy, stub } from 'sinon';
import {
  Account,
  Address,
  AggregateTransaction,
  Currency,
  Deadline,
  Mosaic,
  MosaicId,
  NetworkType,
  PlainMessage,
  Transaction,
  TransactionService,
  TransferTransaction,
  UInt64,
} from 'symbol-sdk';
import {
  AccountResolver,
  AnnounceService,
  Assembly,
  BootstrapService,
  ConfigService,
  Constants,
  DefaultAccountResolver,
  LoggerFactory,
  LogType,
  Preset,
  RemoteNodeService,
  RepositoryInfo,
  TransactionUtils,
  YamlUtils,
} from '../../src';
const logger = LoggerFactory.getLogger(LogType.Silent);
describe('Announce Service', () => {
  let announceService: AnnounceService;
  let accountResolver: AccountResolver;

  beforeEach(() => {
    accountResolver = new DefaultAccountResolver();
    announceService = new AnnounceService(logger, accountResolver);
  });

  afterEach(restore);

  const password = '1234';
  const params = {
    ...ConfigService.defaultParams,
    ready: true,
    target: 'target/tests/announce-service-test',
    password,
    reset: false,
    offline: true,
    preset: Preset.testnet,
    customPresetObject: {
      lastKnownNetworkEpoch: 1,
      nodeUseRemoteAccount: true,
      nodes: [
        {
          mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
          friendlyName: 'myFriendlyName',
        },
      ],
    },
    assembly: Assembly.dual,
  };

  const url = 'http://localhost:3000';
  const maxFee = 2_000_000;
  const useKnownRestGateways = false;
  const networkType = NetworkType.TEST_NET;

  const root = Constants.ROOT_FOLDER;
  const preset = params.preset;
  const networkPresetLocation = `${root}/presets/${preset}/network.yml`;
  const networkPreset = YamlUtils.loadYaml(networkPresetLocation, false);
  const epochAdjustment = parseInt(networkPreset.epochAdjustment.replace('s', ''));
  const networkGenerationHash = networkPreset.nemesisGenerationHashSeed;

  const mainPublicKey = Account.createFromPrivateKey(params.customPresetObject.nodes[0].mainPrivateKey, networkType).publicKey;

  const serviceProviderAccount = Account.createFromPrivateKey(
    '6A9A60768C36769C2D756B0CE4DEE3C50CCE2B08A60CFA259289AA4D2706F3C5',
    networkType,
  );
  const cosigner1 = Account.createFromPrivateKey('41C0163B6A057A4E7B6264AC5BB36C44E0245F8552242BF6A163617C4D616ED3', networkType);
  const cosigner2 = Account.createFromPrivateKey('2FBDC1419F22BC049F6E869B144778277C5930D8D07D55E99ADD2282399FDCF5', networkType);
  const currencyMosaicId = new MosaicId('091F837E059AE13C');

  const singleTransactionFactory = {
    createTransactions(): Promise<Transaction[]> {
      return Promise.resolve([
        TransferTransaction.create(
          Deadline.create(epochAdjustment),
          Address.createFromPublicKey(mainPublicKey, networkType),
          [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
          PlainMessage.create('This is a transfer transaction.'),
          networkType,
          UInt64.fromUint(maxFee),
          undefined,
        ),
      ]);
    },
  };
  const multipleTransactionFactory = {
    createTransactions(): Promise<Transaction[]> {
      return Promise.resolve([
        TransferTransaction.create(
          Deadline.create(epochAdjustment),
          Address.createFromPublicKey(mainPublicKey, networkType),
          [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
          PlainMessage.create('Inner tx 1'),
          networkType,
          UInt64.fromUint(maxFee),
          undefined,
        ),
        TransferTransaction.create(
          Deadline.create(epochAdjustment),
          Address.createFromPublicKey(mainPublicKey, networkType),
          [new Mosaic(currencyMosaicId, UInt64.fromUint(9_000_000))],
          PlainMessage.create('Inner tx 2'),
          networkType,
          UInt64.fromUint(maxFee),
          undefined,
        ),
      ]);
    },
  };

  const stubCommon = (networkType: NetworkType, epochAdjustment: number, currencyMosaicId: MosaicId, networkGenerationHash: string) => {
    stub(RemoteNodeService.prototype, 'getBestRepositoryInfo').callsFake(() =>
      Promise.resolve({
        repositoryFactory: {
          getNetworkType() {
            return of(networkType);
          },
          createTransactionRepository: stub(),
          createReceiptRepository: stub(),
          getEpochAdjustment() {
            return of(epochAdjustment);
          },
          createListener() {
            return {
              open: stub(),
              close: stub(),
            };
          },
          getCurrencies() {
            return of({
              currency: new Currency({
                mosaicId: currencyMosaicId,
                divisibility: 6,
                transferable: true,
                supplyMutable: false,
                restrictable: false,
              }),
            });
          },
          createNetworkRepository() {
            return {
              getTransactionFees() {
                return of({ minFeeMultiplier: 10 });
              },
            };
          },
          createChainRepository() {
            return {
              getChainInfo() {
                return of({ latestFinalizedBlock: 10 });
              },
            };
          },
          getGenerationHash() {
            return of(networkGenerationHash);
          },
        },
      } as unknown as RepositoryInfo),
    );

    stub(announceService, <any>'getAccountInfo').returns(
      Promise.resolve({
        mosaics: [new Mosaic(currencyMosaicId, UInt64.fromUint(100_000_000))],
      }),
    );
  };

  it('Main account regular - Announces simple transaction when single transaction given', async () => {
    const transactionFactory = singleTransactionFactory;

    const { addresses, presetData } = await new BootstrapService(logger).config(params);
    expect(addresses!.nodes![0]!.main.publicKey).eq(mainPublicKey);

    stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);
    const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
    const announceSimple = spy(announceService, <any>'announceSimple');
    await announceService.announce(
      url,
      maxFee,
      useKnownRestGateways,
      params.ready,
      params.target,
      presetData,
      addresses,
      transactionFactory,
    );

    expect(announceSimple.called).to.be.true;
    expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: mainPublicKey }), match.any)).to.be.true;
  });

  it('Main account regular- Announces aggregate complete when multiple transactions given', async () => {
    const transactionFactory = multipleTransactionFactory;

    const { addresses, presetData } = await new BootstrapService(logger).config(params);
    stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

    const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
    const announceAggregateComplete = spy(announceService, <any>'announceAggregateComplete');
    await announceService.announce(
      url,
      maxFee,
      useKnownRestGateways,
      params.ready,
      params.target,
      presetData,
      addresses,
      transactionFactory,
    );

    expect(announceAggregateComplete.called).to.be.true;

    expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: mainPublicKey }), match.any)).to.be.true;
  });

  it('Main account multisig - Announces aggregate complete when single transaction and all required cosignatures given', async () => {
    const transactionFactory = multipleTransactionFactory;
    const cosigns = [cosigner1, cosigner2];
    const bestCosigner = cosigner1;

    const { addresses, presetData } = await new BootstrapService(logger).config(params);
    stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

    stub(TransactionUtils, <any>'getMultisigAccount').returns(
      Promise.resolve({
        minApproval: 2,
      }),
    );
    stub(announceService, <any>'getMultisigBestCosigner').callsFake((multisigAccountInfo, cosigners) => {
      (cosigners as Account[]).push(...cosigns);
      return bestCosigner;
    });
    const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
    const announceAggregateComplete = spy(announceService, <any>'announceAggregateComplete');
    await announceService.announce(
      url,
      maxFee,
      useKnownRestGateways,
      params.ready,
      params.target,
      presetData,
      addresses,
      transactionFactory,
    );

    expect(announceAggregateComplete.called).to.be.true;
    expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
  });

  it('Service provider account regular - Announces aggregate bonded', async () => {
    const transactionFactory = multipleTransactionFactory;

    const { addresses, presetData } = await new BootstrapService(logger).config(params);
    stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);
    stub(accountResolver, 'resolveAccount').returns(Promise.resolve(serviceProviderAccount));

    const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
    const tsAnnounceBonded = stub(TransactionService.prototype, 'announceAggregateBonded').returns(of({} as AggregateTransaction));
    const announceAggregateBonded = spy(announceService, <any>'announceAggregateBonded');
    const createBonded = spy(AggregateTransaction, 'createBonded');
    await announceService.announce(
      url,
      maxFee,
      useKnownRestGateways,
      params.ready,
      params.target,
      presetData,
      addresses,
      transactionFactory,
      'some',
      serviceProviderAccount.publicKey,
    );

    expect(announceAggregateBonded.called).to.be.true;
    expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: serviceProviderAccount.publicKey }), match.any)).to.be.true;
    expect(tsAnnounceBonded.calledOnceWith(match({ signerPublicKey: serviceProviderAccount.publicKey }), match.any)).to.be.true;
    expect(
      createBonded.calledWith(
        match.any,
        [
          match({ signer: { publicKey: mainPublicKey } }),
          match({ signer: { publicKey: mainPublicKey } }),
          match({ signer: { publicKey: serviceProviderAccount.publicKey } }),
        ],
        match.any,
      ),
    ).to.be.true;
  });

  it('Service provider account multisig - Announces aggregate bonded', async () => {
    const transactionFactory = multipleTransactionFactory;
    const cosigns = [cosigner1, cosigner2];
    const bestCosigner = cosigner1;

    const { addresses, presetData } = await new BootstrapService(logger).config(params);
    stubCommon(networkType, epochAdjustment, currencyMosaicId, networkGenerationHash);

    stub(TransactionUtils, <any>'getMultisigAccount').returns(
      Promise.resolve({
        minApproval: 2,
      }),
    );
    stub(announceService, <any>'getMultisigBestCosigner').callsFake((multisigAccountInfo, cosigners) => {
      (cosigners as Account[]).push(...cosigns);
      return bestCosigner;
    });
    stub(accountResolver, 'resolveAccount').returns(Promise.resolve(bestCosigner));
    const tsAnnounce = stub(TransactionService.prototype, 'announce').returns(of({} as Transaction));
    const tsAnnounceBonded = stub(TransactionService.prototype, 'announceAggregateBonded').returns(of({} as AggregateTransaction));
    const announceAggregateBonded = spy(announceService, <any>'announceAggregateBonded');
    const createBonded = spy(AggregateTransaction, 'createBonded');
    await announceService.announce(
      url,
      maxFee,
      useKnownRestGateways,
      params.ready,
      params.target,
      presetData,
      addresses,
      transactionFactory,
      'some',
      serviceProviderAccount.publicKey,
    );

    expect(announceAggregateBonded.called).to.be.true;
    expect(tsAnnounce.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
    expect(tsAnnounceBonded.calledOnceWith(match({ signerPublicKey: bestCosigner.publicKey }), match.any)).to.be.true;
    expect(
      createBonded.calledWith(
        match.any,
        [
          match({ signer: { publicKey: mainPublicKey } }),
          match({ signer: { publicKey: mainPublicKey } }),
          match({ signer: { publicKey: serviceProviderAccount.publicKey } }),
        ],
        match.any,
      ),
    ).to.be.true;
  });
});
