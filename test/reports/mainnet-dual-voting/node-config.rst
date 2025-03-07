Symbol Bootstrap Version: CURRENT_VERSION

config-database.properties
==========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **database**;
    databaseUri; mongodb://db:27017
    databaseName; catapult
    maxWriterThreads; 8
    maxDropBatchSize; 10
    writeTimeout; 10m
    **plugins**;
    catapult.mongo.plugins.accountlink; true
    catapult.mongo.plugins.aggregate; true
    catapult.mongo.plugins.lockhash; true
    catapult.mongo.plugins.locksecret; true
    catapult.mongo.plugins.metadata; true
    catapult.mongo.plugins.mosaic; true
    catapult.mongo.plugins.multisig; true
    catapult.mongo.plugins.namespace; true
    catapult.mongo.plugins.restrictionaccount; true
    catapult.mongo.plugins.restrictionmosaic; true
    catapult.mongo.plugins.transfer; true

config-extensions-broker.properties
===================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.addressextraction; true
    extension.mongo; true
    extension.zeromq; true
    extension.hashcache; true

config-extensions-recovery.properties
=====================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.addressextraction; false
    extension.mongo; false
    extension.zeromq; false
    extension.filespooling; true
    extension.hashcache; true

config-extensions-server.properties
===================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **extensions**;
    extension.filespooling; true
    extension.partialtransaction; true
    extension.addressextraction; false
    extension.mongo; false
    extension.zeromq; false
    extension.harvesting; true
    extension.syncsource; true
    extension.diagnostics; true
    extension.finalization; true
    extension.hashcache; true
    extension.networkheight; false
    extension.nodediscovery; true
    extension.packetserver; true
    extension.pluginhandlers; true
    extension.sync; true
    extension.timesync; true
    extension.transactionsink; true
    extension.unbondedpruning; true

config-finalization.properties
==============================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **finalization**;
    enableVoting; true
    enableRevoteOnBoot; false
    size; 10'000
    threshold; 6'700
    stepDuration; 5m
    shortLivedCacheMessageDuration; 10m
    messageSynchronizationMaxResponseSize; 5MB
    maxHashesPerPoint; 256
    prevoteBlocksMultiple; 4
    unfinalizedBlocksDuration; 0m
    treasuryReissuanceEpoch; 481
    **treasury_reissuance_epoch_ineligible_voter_addresses**;
    ND6667LJBJJ6UMJSZKN2BLHQCS3WNZ3W4UGCFKI; true
    NCKAC225JEFJTB3EO64MIVYF5D7YGZM2ZFXRJNI; true
    NACXOOKIDID7S75S4FFSC7KBBIBHOBUXB5VSE7A; true
    NCVQPB2LZ6UCYKGYJAMCC7V4JGXA35BBY44BMHY; true
    NDSQX6J2QALD2XTU5NQ4FWA2MMEFKBOBEB2BIOQ; true
    NDLFVQ3C25P5VO2VWP6AMHPIJT6FZYTXNJD4ZAY; true
    NCXX3KEIEZ3NABMUU45GM7X7BLMPMQHFOZMMF4Q; true
    NDF4ZCXFKIU5DSJEVBOOI2BDZMDKJTGJVBD6JRY; true
    NCTTMDTZUUQVN4OKTSF3FTEHJQL2QOGAV25MDCA; true
    NDLORKVADZSXTIVAA2FYLDMM7I32AIWE7HDWGUQ; true
    NCQADXOA7ZHLUW2567H33HNNEKCOCN2OJ53PXIQ; true
    NDX4GP6OL32EOSGXSB5FTGKXDJZP4D535ZZYDFI; true
    NCE3EP762222D5D2UAF6KIFL7XZ7U4TPFWBYVHA; true
    NDRLHNV4W7W2M527QOIP35OI3HOMAGTCJDPFDEQ; true
    NDNGH7WJHSMULMCKYE333V6WU4CQDWXZIJK2VCY; true
    NB5NIEQF7FM7LLSFASHOQF4X3F6IPDYSIGR3UVA; true
    NDC3U2UERNMRYFQA45XC74TEEETTZPRUVWKFPAY; true
    NBNCW3DUUHGBCVJ53LYSYYNMKJ52TLR33C5U53A; true
    NCAXT7RH6SUPXEU75EIPAPF7DM4VWUBC5AW2L4Q; true
    NALOQMBU45WOLZ4BCBYZX3N2Y2VSYQFOXGAO34A; true
    NA2KVKEQDZZMM3NGXYVBHZ46JHM46UWIX3KJ4AY; true
    NBI2NEBVAD45WWV44H3A53AQ5675Z4G3ZDGDYLI; true
    NB5ORUTTH2QYHEVTDBB5WPQI4US22FNMODFRK5Y; true
    NDMR4GMUWGMODWY4FF2VZ3CEC2F56HTD3T6EJYY; true
    NCBLL63WUAL7FBNPZQISGJR4WZNB7RVWCWG25MI; true
    NBGGUKW3GEUFHKTO4DYSGDTHIVPKAME3T2XSCGY; true
    NCASTBFHXMHGQB2UJVUDSW7ZI4N2FDW54OTSHKQ; true
    ND726EB3B2VG77J3EEQSGNGUX3SS6L2IEBS7PIY; true
    ND2MRMODKMLCFJWPFJ4MDFI76R7FLZVKIIVKD3A; true
    NDG6ORUW4PVWVQJRQ5AXADQBUQVL3KBX7AW7MUY; true
    NBQS3VKGOJ3YNIABN4Y4SFUDBDQHARUIVS6IMGQ; true
    NCC3VKV3V2HCAP2KTXJUWSXCJ3B6U32EKR6VU5I; true
    NBUW4OTD42VHELNPCLPQCUHNBHR47PQKLP2EKXA; true
    NDBKLXZWYBMUUTNRRZ5ESRAJYMQIMHGLGAYLTGY; true
    NABH3A5VDLYAVA73OV246JTVMAIPD2WEMAQL27I; true
    NCVG74MGUGR3PLVBWVNNACD6R37JA4RCQMXY3DY; true
    NDQLBLKXVOK2YS5G7J3AYYKTNW3S3RRK6RQONAQ; true
    NDTNPG2NUA3MPVDXHLC6D5PSKM4JLLTMQJ5HEDY; true
    ND4MLYCECHPACYSDDQUFMPXONSIQLPAWNVBWSIA; true
    NCNRS6KDPHV4MNMXOEGYD6LNRBMWUR7NT4SZI7I; true
    NBRENIWJUCSUU7RJ5S2DEJVXAOJOTZZDKEFOC3I; true
    NA7YZPY222RVYQMUM65ZSVFSPAHL55UWO3S35FY; true
    NCVR72OUOHVGTVLYBKI7PLUDTIAYPRUWPMJJP3Q; true
    NDE57ICE4UOAPUV3E4CYU3PBA2X4ABUGRGKDFBA; true
    NBBBCIKJV45U7PNYTNXETH2UFZLJ3C6TJKLJDQQ; true
    NCRLDB2O2QDPU57PEG3D3AIFSGPGCZU7VVTKBUY; true
    NC7QENF6OO2FRYV7Q4B5Q74LRSC54Y3YNYN5O3Y; true
    NAL4XHZU6MANNNFQI4Z2WNMU3KRI2YW2MRRMHLI; true
    NC5CFRDWEZVCMGQ4Y77OEFSQLMQ3V4EL7JERY2A; true
    NAIPUZBSDXZIHQKKILAFT3F43IQPS4LOZCH2H4Q; true
    ND6ZNSQG3I7VWLWSJ3DTYVPEZSJRGSEERW2F7DI; true
    NC54KVIISZCMMB3ABAMV6NQ6DAUIYYVKQ23S73Q; true
    NBNRFJSGE53UNHBGZIHYZXPG7SHLQISJN5REGIY; true
    NCFFJV3VTAK6BJZNV6ZRUZKUJPOWST6MYFAAK5A; true
    NAAZKYH4V6SARDIJRGFXYEZIHVRWY7R2T62QFYA; true
    NAGCLXJZHZSBM5ILN4LQBDKU4NYVHB6ZLGRTKJI; true
    NBGEJ36QK43DR4MYB6XFUFLSVFLULX3HBVNRCVY; true
    NCGCVCURBA2GCKPEGEA2Q6HKFEHYITKUNWRLMEA; true
    NA5ZUGHBUUHO63E5OQQND7CYK7UZ3HVQONR2O6Y; true
    NC2GXL6FQXZY3FXZAYJLBDQHBKSANZLGP4PL7VA; true
    NB3WMVRI4RM3O3NUSWBZM7U4EZMKADSOFDPPJRQ; true
    NCFH35TMUJ5QJL6LTBYRBO7ERMM4NIBH7TL6TFY; true

config-harvesting.properties
============================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **harvesting**; ; ;
    harvesterSigningPrivateKey; ****************************************************************; string; Harvester signing private key.
    harvesterVrfPrivateKey; ****************************************************************; string; Harvester vrf private key.
    enableAutoHarvesting; true; bool; Set to true if auto harvesting is enabled.
    maxUnlockedAccounts; 10; uint32_t; Maximum number of unlocked accounts.
    delegatePrioritizationPolicy; Importance; harvesting::DelegatePrioritizationPolicy; Delegate harvester prioritization policy.
    beneficiaryAddress; NDQ32MTJICEPJDU45KVN7BAM4A4GI7OARNBUUFY; Address; Address of the account receiving part of the harvested fee.

config-inflation.properties
===========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **inflation**;
    starting-at-height-2; 0
    starting-at-height-5760; 191997042
    starting-at-height-172799; 183764522
    starting-at-height-435299; 175884998
    starting-at-height-697799; 168343336
    starting-at-height-960299; 161125048
    starting-at-height-1222799; 154216270
    starting-at-height-1485299; 147603728
    starting-at-height-1747799; 141274720
    starting-at-height-2010299; 135217090
    starting-at-height-2272799; 129419202
    starting-at-height-2535299; 123869918
    starting-at-height-2797799; 118558578
    starting-at-height-3060299; 113474978
    starting-at-height-3322799; 108609356
    starting-at-height-3585299; 103952364
    starting-at-height-3847799; 99495056
    starting-at-height-4110299; 95228870
    starting-at-height-4372799; 91145612
    starting-at-height-4635299; 87237436
    starting-at-height-4897799; 83496838
    starting-at-height-5160299; 79916630
    starting-at-height-5422799; 76489934
    starting-at-height-5685299; 73210170
    starting-at-height-5947799; 70071038
    starting-at-height-6210299; 67066506
    starting-at-height-6472799; 64190804
    starting-at-height-6735299; 61438406
    starting-at-height-6997799; 58804028
    starting-at-height-7260299; 56282608
    starting-at-height-7522799; 53869300
    starting-at-height-7785299; 51559472
    starting-at-height-8047799; 49348686
    starting-at-height-8310299; 47232696
    starting-at-height-8572799; 45207434
    starting-at-height-8835299; 43269014
    starting-at-height-9097799; 41413708
    starting-at-height-9360299; 39637956
    starting-at-height-9622799; 37938346
    starting-at-height-9885299; 36311610
    starting-at-height-10147799; 34754628
    starting-at-height-10410299; 33264406
    starting-at-height-10672799; 31838082
    starting-at-height-10935299; 30472918
    starting-at-height-11197799; 29166288
    starting-at-height-11460299; 27915686
    starting-at-height-11722799; 26718706
    starting-at-height-11985299; 25573052
    starting-at-height-12247799; 24476520
    starting-at-height-12510299; 23427008
    starting-at-height-12772799; 22422496
    starting-at-height-13035299; 21461056
    starting-at-height-13297799; 20540840
    starting-at-height-13560299; 19660082
    starting-at-height-13822799; 18817090
    starting-at-height-14085299; 18010244
    starting-at-height-14347799; 17237994
    starting-at-height-14610299; 16498858
    starting-at-height-14872799; 15791412
    starting-at-height-15135299; 15114302
    starting-at-height-15397799; 14466226
    starting-at-height-15660299; 13845938
    starting-at-height-15922799; 13252246
    starting-at-height-16185299; 12684012
    starting-at-height-16447799; 12140142
    starting-at-height-16710299; 11619592
    starting-at-height-16972799; 11121364
    starting-at-height-17235299; 10644498
    starting-at-height-17497799; 10188078
    starting-at-height-17760299; 9751230
    starting-at-height-18022799; 9333114
    starting-at-height-18285299; 8932924
    starting-at-height-18547799; 8549896
    starting-at-height-18810299; 8183290
    starting-at-height-19072799; 7832404
    starting-at-height-19335299; 7496562
    starting-at-height-19597799; 7175122
    starting-at-height-19860299; 6867464
    starting-at-height-20122799; 6573000
    starting-at-height-20385299; 6291160
    starting-at-height-20647799; 6021404
    starting-at-height-20910299; 5763216
    starting-at-height-21172799; 5516100
    starting-at-height-21435299; 5279578
    starting-at-height-21697799; 5053198
    starting-at-height-21960299; 4836526
    starting-at-height-22222799; 4629144
    starting-at-height-22485299; 4430652
    starting-at-height-22747799; 4240674
    starting-at-height-23010299; 4058840
    starting-at-height-23272799; 3884804
    starting-at-height-23535299; 3718230
    starting-at-height-23797799; 3558798
    starting-at-height-24060299; 3406202
    starting-at-height-24322799; 3260150
    starting-at-height-24585299; 3120360
    starting-at-height-24847799; 2986564
    starting-at-height-25110299; 2858506
    starting-at-height-25372799; 2735938
    starting-at-height-25635299; 2618624
    starting-at-height-25897799; 2506342
    starting-at-height-26160299; 2398874
    starting-at-height-26422799; 2296014
    starting-at-height-26685299; 2197564
    starting-at-height-26947799; 2103336
    starting-at-height-27210299; 2013150
    starting-at-height-27472799; 1926828
    starting-at-height-27735299; 1844210
    starting-at-height-27997799; 1765132
    starting-at-height-28260299; 1689446
    starting-at-height-28522799; 1617006
    starting-at-height-28785299; 1547672
    starting-at-height-29047799; 1481310
    starting-at-height-29310299; 1417794
    starting-at-height-29572799; 1357000
    starting-at-height-29835299; 1298814
    starting-at-height-30097799; 1243124
    starting-at-height-30360299; 1189820
    starting-at-height-30622799; 1138802
    starting-at-height-30885299; 1089972
    starting-at-height-31147799; 1043236
    starting-at-height-31410299; 998504
    starting-at-height-31672799; 955690
    starting-at-height-31935299; 914712
    starting-at-height-32197799; 875490
    starting-at-height-32460299; 837950
    starting-at-height-32722799; 802020
    starting-at-height-32985299; 767630
    starting-at-height-33247799; 734716
    starting-at-height-33510299; 703212
    starting-at-height-33772799; 673060
    starting-at-height-34035299; 644200
    starting-at-height-34297799; 616578
    starting-at-height-34560299; 590140
    starting-at-height-34822799; 564836
    starting-at-height-35085299; 540616
    starting-at-height-35347799; 517436
    starting-at-height-35610299; 495248
    starting-at-height-35872799; 474014
    starting-at-height-36135299; 453688
    starting-at-height-36397799; 434234
    starting-at-height-36660299; 415616
    starting-at-height-36922799; 397794
    starting-at-height-37185299; 380738
    starting-at-height-37447799; 364412
    starting-at-height-37710299; 348786
    starting-at-height-37972799; 333832
    starting-at-height-38235299; 319518
    starting-at-height-38497799; 305816
    starting-at-height-38760299; 292704
    starting-at-height-39022799; 280154
    starting-at-height-39285299; 268140
    starting-at-height-39547799; 256644
    starting-at-height-39810299; 245638
    starting-at-height-40072799; 235106
    starting-at-height-40335299; 225026
    starting-at-height-40597799; 215376
    starting-at-height-40860299; 206142
    starting-at-height-41122799; 197302
    starting-at-height-41385299; 188842
    starting-at-height-41647799; 180744
    starting-at-height-41910299; 172994
    starting-at-height-42172799; 165578
    starting-at-height-42435299; 158478
    starting-at-height-42697799; 151682
    starting-at-height-42960299; 145178
    starting-at-height-43222799; 138954
    starting-at-height-43485299; 132994
    starting-at-height-43747799; 127292
    starting-at-height-44010299; 121834
    starting-at-height-44272799; 116610
    starting-at-height-44535299; 111610
    starting-at-height-44797799; 106824
    starting-at-height-45060299; 102244
    starting-at-height-45322799; 97860
    starting-at-height-45585299; 93664
    starting-at-height-45847799; 89648
    starting-at-height-46110299; 85804
    starting-at-height-46372799; 82124
    starting-at-height-46635299; 78602
    starting-at-height-46897799; 75232
    starting-at-height-47160299; 72006
    starting-at-height-47422799; 68920
    starting-at-height-47685299; 65964
    starting-at-height-47947799; 63136
    starting-at-height-48210299; 60428
    starting-at-height-48472799; 57838
    starting-at-height-48735299; 55358
    starting-at-height-48997799; 52984
    starting-at-height-49260299; 50712
    starting-at-height-49522799; 48538
    starting-at-height-49785299; 46456
    starting-at-height-50047799; 44464
    starting-at-height-50310299; 42558
    starting-at-height-50572799; 40732
    starting-at-height-50835299; 38986
    starting-at-height-51097799; 37314
    starting-at-height-51360299; 35714
    starting-at-height-51622799; 34182
    starting-at-height-51885299; 32716
    starting-at-height-52147799; 31314
    starting-at-height-52410299; 29972
    starting-at-height-52672799; 28686
    starting-at-height-52935299; 27456
    starting-at-height-53197799; 26278
    starting-at-height-53460299; 25152
    starting-at-height-53722799; 24074
    starting-at-height-53985299; 23042
    starting-at-height-54247799; 22054
    starting-at-height-54510299; 21108
    starting-at-height-54772799; 20202
    starting-at-height-55035299; 19336
    starting-at-height-55297799; 18506
    starting-at-height-55560299; 17714
    starting-at-height-55822799; 16954
    starting-at-height-56085299; 16226
    starting-at-height-56347799; 15532
    starting-at-height-56610299; 14866
    starting-at-height-56872799; 14228
    starting-at-height-57135299; 13618
    starting-at-height-57397799; 13034
    starting-at-height-57660299; 12474
    starting-at-height-57922799; 11940
    starting-at-height-58185299; 11428
    starting-at-height-58447799; 10938
    starting-at-height-58710299; 10468
    starting-at-height-58972799; 10020
    starting-at-height-59235299; 9590
    starting-at-height-59497799; 9178
    starting-at-height-59760299; 8786
    starting-at-height-60022799; 8408
    starting-at-height-60285299; 8048
    starting-at-height-60547799; 7702
    starting-at-height-60810299; 7372
    starting-at-height-61072799; 7056
    starting-at-height-61335299; 6754
    starting-at-height-61597799; 6464
    starting-at-height-61860299; 6186
    starting-at-height-62122799; 5922
    starting-at-height-62385299; 5668
    starting-at-height-62647799; 5424
    starting-at-height-62910299; 5192
    starting-at-height-63172799; 4970
    starting-at-height-63435299; 4756
    starting-at-height-63697799; 4552
    starting-at-height-63960299; 4356
    starting-at-height-64222799; 4170
    starting-at-height-64485299; 3992
    starting-at-height-64747799; 3820
    starting-at-height-65010299; 3656
    starting-at-height-65272799; 3500
    starting-at-height-65535299; 3350
    starting-at-height-65797799; 3206
    starting-at-height-66060299; 3068
    starting-at-height-66322799; 2936
    starting-at-height-66585299; 2810
    starting-at-height-66847799; 2690
    starting-at-height-67110299; 2574
    starting-at-height-67372799; 2464
    starting-at-height-67635299; 2358
    starting-at-height-67897799; 2258
    starting-at-height-68160299; 2160
    starting-at-height-68422799; 2068
    starting-at-height-68685299; 1980
    starting-at-height-68947799; 1894
    starting-at-height-69210299; 1812
    starting-at-height-69472799; 1736
    starting-at-height-69735299; 1660
    starting-at-height-69997799; 1590
    starting-at-height-70260299; 1522
    starting-at-height-70522799; 1456
    starting-at-height-70785299; 1394
    starting-at-height-71047799; 1334
    starting-at-height-71310299; 1276
    starting-at-height-71572799; 1222
    starting-at-height-71835299; 1170
    starting-at-height-72097799; 1120
    starting-at-height-72360299; 1072
    starting-at-height-72622799; 1026
    starting-at-height-72885299; 982
    starting-at-height-73147799; 938
    starting-at-height-73410299; 898
    starting-at-height-73672799; 860
    starting-at-height-73935299; 824
    starting-at-height-74197799; 788
    starting-at-height-74460299; 754
    starting-at-height-74722799; 722
    starting-at-height-74985299; 690
    starting-at-height-75247799; 662
    starting-at-height-75510299; 632
    starting-at-height-75772799; 606
    starting-at-height-76035299; 580
    starting-at-height-76297799; 554
    starting-at-height-76560299; 530
    starting-at-height-76822799; 508
    starting-at-height-77085299; 486
    starting-at-height-77347799; 466
    starting-at-height-77610299; 446
    starting-at-height-77872799; 426
    starting-at-height-78135299; 408
    starting-at-height-78397799; 390
    starting-at-height-78660299; 374
    starting-at-height-78922799; 358
    starting-at-height-79185299; 342
    starting-at-height-79447799; 328
    starting-at-height-79710299; 314
    starting-at-height-79972799; 300
    starting-at-height-80235299; 286
    starting-at-height-80497799; 274
    starting-at-height-80760299; 262
    starting-at-height-81022799; 252
    starting-at-height-81285299; 240
    starting-at-height-81547799; 230
    starting-at-height-81810299; 220
    starting-at-height-82072799; 210
    starting-at-height-82335299; 202
    starting-at-height-82597799; 194
    starting-at-height-82860299; 184
    starting-at-height-83122799; 176
    starting-at-height-83385299; 170
    starting-at-height-83647799; 162
    starting-at-height-83910299; 154
    starting-at-height-84172799; 148
    starting-at-height-84435299; 142
    starting-at-height-84697799; 136
    starting-at-height-84960299; 130
    starting-at-height-85222799; 124
    starting-at-height-85485299; 118
    starting-at-height-85747799; 114
    starting-at-height-86010299; 108
    starting-at-height-86272799; 104
    starting-at-height-86535299; 100
    starting-at-height-86797799; 96
    starting-at-height-87060299; 92
    starting-at-height-87322799; 88
    starting-at-height-87585299; 84
    starting-at-height-87847799; 80
    starting-at-height-88110299; 76
    starting-at-height-88372799; 72
    starting-at-height-88635299; 70
    starting-at-height-88897799; 66
    starting-at-height-89160299; 64
    starting-at-height-89422799; 62
    starting-at-height-89685299; 58
    starting-at-height-89947799; 56
    starting-at-height-90210299; 54
    starting-at-height-90472799; 52
    starting-at-height-90735299; 48
    starting-at-height-90997799; 46
    starting-at-height-91260299; 44
    starting-at-height-91522799; 42
    starting-at-height-91785299; 40
    starting-at-height-92047799; 40
    starting-at-height-92310299; 38
    starting-at-height-92572799; 36
    starting-at-height-92835299; 34
    starting-at-height-93097799; 32
    starting-at-height-93360299; 32
    starting-at-height-93622799; 30
    starting-at-height-93885299; 28
    starting-at-height-94147799; 28
    starting-at-height-94410299; 26
    starting-at-height-94672799; 24
    starting-at-height-94935299; 24
    starting-at-height-95197799; 22
    starting-at-height-95460299; 22
    starting-at-height-95722799; 20
    starting-at-height-95985299; 20
    starting-at-height-96247799; 18
    starting-at-height-96510299; 18
    starting-at-height-96772799; 18
    starting-at-height-97035299; 16
    starting-at-height-97297799; 16
    starting-at-height-97560299; 14
    starting-at-height-97822799; 14
    starting-at-height-98085299; 14
    starting-at-height-98347799; 12
    starting-at-height-98610299; 12
    starting-at-height-98872799; 12
    starting-at-height-99135299; 12
    starting-at-height-99397799; 10
    starting-at-height-99660299; 10
    starting-at-height-99922799; 10
    starting-at-height-100185299; 10
    starting-at-height-100447799; 8
    starting-at-height-100710299; 8
    starting-at-height-100972799; 8
    starting-at-height-101235299; 8
    starting-at-height-101497799; 8
    starting-at-height-101760299; 6
    starting-at-height-102022799; 6
    starting-at-height-102285299; 6
    starting-at-height-102547799; 6
    starting-at-height-102810299; 6
    starting-at-height-103072799; 6
    starting-at-height-103335299; 6
    starting-at-height-103597799; 4
    starting-at-height-103860299; 4
    starting-at-height-104122799; 4
    starting-at-height-104385299; 4
    starting-at-height-104647799; 4
    starting-at-height-104910299; 4
    starting-at-height-105172799; 4
    starting-at-height-105435299; 4
    starting-at-height-105697799; 4
    starting-at-height-105960299; 2
    starting-at-height-106222799; 2
    starting-at-height-106485299; 2
    starting-at-height-106747799; 2
    starting-at-height-107010299; 2
    starting-at-height-107272799; 2
    starting-at-height-107535299; 2
    starting-at-height-107797799; 2
    starting-at-height-108060299; 2
    starting-at-height-108322799; 2
    starting-at-height-108585299; 2
    starting-at-height-108847799; 2
    starting-at-height-109110299; 2
    starting-at-height-109372799; 2
    starting-at-height-109635299; 2
    starting-at-height-109897799; 2
    starting-at-height-110160299; 1
    starting-at-height-110422799; 0

config-logging-broker.properties
================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Async
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Async
    level; Info
    directory; logs
    filePattern; logs/catapult_broker%4N.log
    rotationSize; 25MB
    maxTotalSize; 1000MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-logging-recovery.properties
==================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Async
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Async
    level; Info
    directory; logs
    filePattern; logs/catapult_recovery%4N.log
    rotationSize; 25MB
    maxTotalSize; 1000MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-logging-server.properties
================================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **console**;
    sinkType; Async
    level; Info
    colorMode; Ansi
    **console.component.levels**;
    **file**;
    sinkType; Async
    level; Info
    directory; logs
    filePattern; logs/catapult_server%4N.log
    rotationSize; 25MB
    maxTotalSize; 1000MB
    minFreeSpace; 100MB
    **file.component.levels**;

config-messaging.properties
===========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **messaging**;
    subscriberPort; 7902
    listenInterface; 0.0.0.0

config-network.properties
=========================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **network**; ; ;
    identifier; mainnet; NetworkIdentifier; Network identifier.
    nemesisSignerPublicKey; BE0B4CF546B7B4F4BBFCFF9F574FDA527C07A53D3FC76F8BB7DB746F8E8E0A9F; Key; Nemesis public key.
    nodeEqualityStrategy; host; NodeIdentityEqualityStrategy; Node equality strategy.
    generationHashSeed; 57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6; ;
    epochAdjustment; 1615853185s; utils::TimeSpan; Nemesis epoch time adjustment.
    **chain**; ; ;
    enableVerifiableState; true; bool; Set to true if block chain should calculate state hashes so that state is fully verifiable at each block.
    enableVerifiableReceipts; true; bool; Set to true if block chain should calculate receipts so that state changes are fully verifiable at each block.
    currencyMosaicId; 0x6BED'913F'A202'23F8; MosaicId; Mosaic id used as primary chain currency.
    harvestingMosaicId; 0x6BED'913F'A202'23F8; MosaicId; Mosaic id used to provide harvesting ability.
    blockGenerationTargetTime; 30s; utils::TimeSpan; Targeted time between blocks.
    blockTimeSmoothingFactor; 3000; uint32_t; Note: A higher value makes the network more biased. Note: This can lower security because it will increase the influence of time relative to importance.
    importanceGrouping; 720; uint64_t; Number of blocks that should be treated as a group for importance purposes. Note: Importances will only be calculated at blocks that are multiples of this grouping number.
    importanceActivityPercentage; 5; uint8_t; Percentage of importance resulting from fee generation and beneficiary usage.
    maxRollbackBlocks; 0; uint32_t; Maximum number of blocks that can be rolled back.
    maxDifficultyBlocks; 60; uint32_t; Maximum number of blocks to use in a difficulty calculation.
    defaultDynamicFeeMultiplier; 100; BlockFeeMultiplier; Default multiplier to use for dynamic fees.
    maxTransactionLifetime; 6h; utils::TimeSpan; Maximum lifetime a transaction can have before it expires.
    maxBlockFutureTime; 300ms; utils::TimeSpan; Maximum future time of a block that can be accepted.
    initialCurrencyAtomicUnits; 7'842'928'625'000'000; Amount; Initial currency atomic units available in the network.
    maxMosaicAtomicUnits; 8'999'999'999'000'000; Amount; Maximum atomic units (total-supply * 10 ^ divisibility) of a mosaic allowed in the network.
    totalChainImportance; 7'842'928'625'000'000; Importance; Total whole importance units available in the network.
    minHarvesterBalance; 10'000'000'000; Amount; Minimum number of harvesting mosaic atomic units needed for an account to be eligible for harvesting.
    maxHarvesterBalance; 50'000'000'000'000; Amount; Maximum number of harvesting mosaic atomic units needed for an account to be eligible for harvesting.
    minVoterBalance; 3'000'000'000'000; Amount; Minimum number of harvesting mosaic atomic units needed for an account to be eligible for voting.
    votingSetGrouping; 1440; ;
    maxVotingKeysPerAccount; 3; uint8_t; Maximum number of voting keys that can be registered at once per account.
    minVotingKeyLifetime; 112; uint32_t; Minimum number of finalization rounds for which voting key can be registered.
    maxVotingKeyLifetime; 360; uint32_t; Maximum number of finalization rounds for which voting key can be registered.
    harvestBeneficiaryPercentage; 25; uint8_t; Percentage of the harvested fee that is collected by the beneficiary account.
    harvestNetworkPercentage; 5; uint8_t; Percentage of the harvested fee that is collected by the network.
    harvestNetworkFeeSinkAddressV1; NBUTOBVT5JQDCV6UEPCPFHWWOAOPOCLA5AY5FLI; ;
    harvestNetworkFeeSinkAddress; NAVORTEX3IPBAUWQBBI3I3BDIOS4AVHPZLCFC7Y; Address; Address of the harvest network fee sink account.
    maxTransactionsPerBlock; 6'000; uint32_t; Maximum number of transactions per block.
    **plugin:catapult.plugins.accountlink**;
    dummy; to trigger plugin load
    **plugin:catapult.plugins.aggregate**; ; ;
    maxTransactionsPerAggregate; 100; uint32_t; Maximum number of transactions per aggregate.
    maxCosignaturesPerAggregate; 25; uint8_t; Maximum number of cosignatures per aggregate.
    enableStrictCosignatureCheck; false; bool; Set to true if cosignatures must exactly match component signers. Set to false if cosignatures should be validated externally.
    enableBondedAggregateSupport; true; bool; Set to true if bonded aggregates should be allowed. Set to false if bonded aggregates should be rejected.
    maxBondedTransactionLifetime; 48h; utils::TimeSpan; Maximum lifetime a bonded transaction can have before it expires.
    **plugin:catapult.plugins.lockhash**; ; ;
    lockedFundsPerAggregate; 10'000'000; Amount; Amount that has to be locked per aggregate in partial cache.
    maxHashLockDuration; 2d; utils::BlockSpan; Maximum number of blocks for which a hash lock can exist.
    **plugin:catapult.plugins.locksecret**; ; ;
    maxSecretLockDuration; 365d; utils::BlockSpan; Maximum number of blocks for which a secret lock can exist.
    minProofSize; 0; uint16_t; Minimum size of a proof in bytes.
    maxProofSize; 1024; uint16_t; Maximum size of a proof in bytes.
    **plugin:catapult.plugins.metadata**; ; ;
    maxValueSize; 1024; uint16_t; Maximum metadata value size.
    **plugin:catapult.plugins.mosaic**; ; ;
    maxMosaicsPerAccount; 1'000; uint16_t; Maximum number of mosaics that an account can own.
    maxMosaicDuration; 3650d; utils::BlockSpan; Maximum mosaic duration.
    maxMosaicDivisibility; 6; uint8_t; Maximum mosaic divisibility.
    mosaicRentalFeeSinkAddressV1; NC733XE7DF46Q7QYLIIZBBSCJN2BEEP5FQ6PAYA; ;
    mosaicRentalFeeSinkAddress; NCVORTEX4XD5IQASZQEHDWUXT33XBOTBMKFDCLI; Address; Address of the mosaic rental fee sink account.
    mosaicRentalFee; 500000; Amount; Mosaic rental fee.
    **plugin:catapult.plugins.multisig**; ; ;
    maxMultisigDepth; 3; uint8_t; Maximum number of multisig levels.
    maxCosignatoriesPerAccount; 25; uint32_t; Maximum number of cosignatories per account.
    maxCosignedAccountsPerAccount; 25; uint32_t; Maximum number of accounts a single account can cosign.
    **plugin:catapult.plugins.namespace**; ; ;
    maxNameSize; 64; uint8_t; Maximum namespace name size.
    maxChildNamespaces; 100; uint16_t; Maximum number of children for a root namespace.
    maxNamespaceDepth; 3; uint8_t; Maximum namespace depth.
    minNamespaceDuration; 30d; utils::BlockSpan; Minimum namespace duration.
    maxNamespaceDuration; 1825d; utils::BlockSpan; Maximum namespace duration.
    namespaceGracePeriodDuration; 30d; utils::BlockSpan; Grace period during which time only the previous owner can renew an expired namespace.
    reservedRootNamespaceNames; symbol, symbl, xym, xem, nem, user, account, org, com, biz, net, edu, mil, gov, info; unordered_set<string>; Reserved root namespaces that cannot be claimed.
    namespaceRentalFeeSinkAddressV1; NBDTBUD6R32ZYJWDEWLJM4YMOX3OOILHGDUMTSA; ;
    namespaceRentalFeeSinkAddress; NCVORTEX4XD5IQASZQEHDWUXT33XBOTBMKFDCLI; Address; Address of the namespace rental fee sink account.
    rootNamespaceRentalFeePerBlock; 2; Amount; Root namespace rental fee per block.
    childNamespaceRentalFee; 100000; Amount; Child namespace rental fee.
    **plugin:catapult.plugins.restrictionaccount**; ; ;
    maxAccountRestrictionValues; 100; uint16_t; Maximum number of account restriction values.
    **plugin:catapult.plugins.restrictionmosaic**; ; ;
    maxMosaicRestrictionValues; 20; uint8_t; Maximum number of mosaic restriction values.
    **plugin:catapult.plugins.transfer**; ; ;
    maxMessageSize; 1024; uint16_t; Maximum transaction message size.
    **fork_heights**; ; ;
    totalVotingBalanceCalculationFix; 528'000; uint32_t; Height of fork to fix TotalVotingBalance calculation.
    treasuryReissuance; 689'761; ;
    strictAggregateTransactionHash; 1'690'500; ;
    skipSecretLockUniquenessChecks; 3'191'538; ;
    skipSecretLockExpirations; 3'197'860, 3'197'866; ;
    forceSecretLockExpirations; 3'197'458, 3'197'781; ;
    **treasury_reissuance_transaction_signatures**;
    0BBEADD37539444D75C09A245102D2B883267925398504623835DCD625290DEE4FA2371341050C49C001DEDD1C9FE241EA4A7DB335B2069FD4DAFF77AF734C03; true
    89447704270E8B2F8EED19526587DB58870D90A02ACEF8AE2A54311DEB95C227201CD39662A0229D5746FFB84074EA6C7DD9620A2CE5AA69065C508DC0335201; true
    D19BCD440545CF785D88F903141DE794F2D57012509BC224B25BFCA220267D1ADD42182702F50C1A4E95D0F21604E4F9EEEEF329932FCD0C76B43992B0D90B0D; true
    C478DB6053C639AFC96F5D965159DC95449E5EE69A62E5FA28DF42D85C031B3A131B3AC403D9BFF27E1E64FD8012D05C720F0D2A8654D9F4BC48C8DD2DCEBC03; true
    C0BAE301EC15B514C5685A661BC3E23A6596CE9DC412A83F67A8C8611A4415B1B0447E8C09D2816CAE0D750C4AB1ED8FE9C85C05D448C2114147A2C935030708; true
    A317F4EB085C8D3D80435669EF54C6C9C9AD9B57165B14CF051F43879D0112E3A79591DD6D469BFAA850891FA2CB601BA58CD1BAEBFF5D84C49179AC7FE14706; true
    FDB98C472D0B98FDD766DA177366DEB2DB0E79721BD73DA96A84622A98932DA75BAA327BA9E23D448C6F25344654A6F17F7734C14D1530B327F911A97B4DE30A; true
    **corrupt_aggregate_transaction_hashes**;
    97CA49FCE55644FF28248C6EA4DCB6E87E53909811DEE2513F0218DAA394679F; 657BE411624B617F51CD8D151735F50FE50A91A5B7D0658192EF3EC4DD0C91C3
    B2813813F709C3011468E23E61AE102BCB55A28A87D0CF74968B8BD2413615AA; 3FEF96C5496E60BC1D33815139BDCD4FA707CE1C2A9A25FF4F7D3B1BE698116C
    30FA71E6D1E34DF1E430A07E1B0817BED9A4ED6B0245B7471B0557380A700E1B; AE377EAB7F1970DEC21FF305C39EBDD3ECE413B911EF3E4E11F7DDDC9C9C9748
    E14FB95DA63CDA9899474D7EFD0DCB6A6C9E8931DF12ECA01F22DF2B59B6624C; 342E7C1E6318F7DCE5CE5A09B8FA1820453C4437AEF1B872BD06531E3ADB41C0
    55EB9659C81600F1760C4C0A4F8A7A5C90A39FCEE36E3165143B8E72BBC709E8; 8980CF4407A48410C4E910FE766C135F8C3C84EA9917BFDB7A71434C2CDC625A
    D24D000FABBD1AC4BC21006A5CAE76AE9C32792A4920F66D6A6C6F76B438BDF1; 5FDEF85E8B3669FF155B5F3DA98288C6ED8A293CC699338ADB743C0F5E8614ED
    26FF5E7174DEEF3147DB25C37C7AE9905157ACBA2D233D40D1F77A65B60D59BC; 3A2F78C2E7B10FF84EB33BF1DD0FD61951F8E3EA3303614D1B20060CD88F6E14
    2DF1D19B5E68102665D11B3CF3069AB5DFED2E60A7690C8788172E0E5E30B72D; 3B64321593D06FF37B191F52FE31E107A8FDB0116AB5374157F8F415B8C73BE4
    8BAA5EC2DDF55EE583ABB7EA4A4FE6EB8A4C16C41ED30CB1E68F6D1F40C3FC5A; 59850BF728A08555D10DAD5745EE2A349FECC0B16810F5D32CF3DFC376DEFFE1
    8CE147B1B64E200FA48B17FE5B6F4FA2FFEC83FF03A1EC0D4725AB8122AF5B05; 1F3D4045C3482A9EED536F61CAA58284323037B72A9A774A0C75932F85999B0F
    BC312549DB027287836AD52B6EA30171AA1958B20BEB3D659F843D699DE45FD3; 4AC4B12DE7C5B0D02BFFEA3ED98F4247FAFF701C4CE0A2CFD75E7F633DB0ED60
    B35D60C826470EB38B6963DCEF5A9FE406EDE405676EDB027956999D7618998D; D8915C7EFFDB62B3CB5872597522C0920AF5D55EC44A4548DF8679C08A0C0541
    91C27BE7E5AC8EBCE6A5D576DE250054A3CDC2B674BAD5FA29B554C0A50E2973; 05718908AFBA83B420AE19BE0A11EE36119AC960353BA6C3F180078C8C4B428D
    D91689D6A3C9FE7AABB45C3FC44373DA23EF363D71360CB4B7ECD74F0BDE893B; D8915C7EFFDB62B3CB5872597522C0920AF5D55EC44A4548DF8679C08A0C0541
    8090FFF457D88D98ACFDA7872DAAD1A901B4CB081387B1A45AFDA8EEF686EB54; 05718908AFBA83B420AE19BE0A11EE36119AC960353BA6C3F180078C8C4B428D
    33937869216924161235BA8E10DC075592022C22F6593042A1064ADD24B64FE8; 9C00D552960DEDC38A009B541681B2C7A68902D94A9D6C089604D2E7EFCCD88E
    BDF7755E44E1405C3353AB97651DD82785C6A3A8EAA5EA1CEA0E30DADB0D12F8; B6D02DA3F69C20F69A9209B13192174091544512CD7D2CE53C366909B354B7B1
    852A41F9452A34054DE1C21E46F925EA7B50D26AF97FBA8D745F01CC6DD5097F; 8626BB52F6457D95B01A5C178E6A6977F8BD418CD9A7D5B0A814210E0A4FBBA3
    C1E7404CDAE41ACE07E8649FA2D5E3E2FF5DA502E43E5D1C6073192823F90BE6; A7321E82547506079C0692DC0DFF8C9CB0D56DD2C9E3208F479DB8970B985E6C
    C0FAAD2439E9D8017F9A2E5F67A46850195209402C1EE55CF99880426D0F454F; 3B74892D50665E4A989C89EDCE88905937B81BF260A679653E86886407812F83

config-node.properties
======================
.. csv-table::
    :header: "Property", "Value", "Type", "Description"
    :delim: ;

    **node**; ; ;
    port; 7900; unsigned short; Server port.
    maxIncomingConnectionsPerIdentity; 6; uint32_t; Maximum number of incoming connections per identity over primary port.
    enableAddressReuse; false; bool; Set to true if the server should reuse ports already in use.
    enableSingleThreadPool; false; bool; Set to true if a single thread pool should be used, Set to false if multiple thread pools should be used.
    enableCacheDatabaseStorage; true; bool; Set to true if cache data should be saved in a database.
    enableAutoSyncCleanup; false; bool; Set to true if temporary sync files should be automatically cleaned up. Note: This should be Set to false if broker process is running.
    fileDatabaseBatchSize; 100; ;
    enableTransactionSpamThrottling; true; bool; Set to true if transaction spam throttling should be enabled.
    transactionSpamThrottlingMaxBoostFee; 10'000'000; Amount; Maximum fee that will boost a transaction through the spam throttle when spam throttling is enabled.
    maxHashesPerSyncAttempt; 370; ;
    maxBlocksPerSyncAttempt; 360; uint32_t; Maximum number of blocks per sync attempt.
    maxChainBytesPerSyncAttempt; 50MB; utils::FileSize; Maximum chain bytes per sync attempt.
    shortLivedCacheTransactionDuration; 10m; utils::TimeSpan; Duration of a transaction in the short lived cache.
    shortLivedCacheBlockDuration; 100m; utils::TimeSpan; Duration of a block in the short lived cache.
    shortLivedCachePruneInterval; 90s; utils::TimeSpan; Time between short lived cache pruning.
    shortLivedCacheMaxSize; 10'000'000; uint32_t; Maximum size of a short lived cache.
    minFeeMultiplier; 100; BlockFeeMultiplier; Minimum fee multiplier of transactions to propagate and include in blocks.
    maxTimeBehindPullTransactionsStart; 5m; ;
    transactionSelectionStrategy; oldest; model::TransactionSelectionStrategy; Transaction selection strategy used for syncing and harvesting unconfirmed transactions.
    unconfirmedTransactionsCacheMaxResponseSize; 5MB; utils::FileSize; Maximum size of an unconfirmed transactions response.
    unconfirmedTransactionsCacheMaxSize; 20MB; uint32_t; Maximum size of the unconfirmed transactions cache.
    connectTimeout; 15s; utils::TimeSpan; Timeout for connecting to a peer.
    syncTimeout; 5m; utils::TimeSpan; Timeout for syncing with a peer.
    socketWorkingBufferSize; 16KB; utils::FileSize; Initial socket working buffer size (socket reads will attempt to read buffers of roughly this size).
    socketWorkingBufferSensitivity; 1; uint32_t; Socket working buffer sensitivity (lower values will cause memory to be more aggressively reclaimed). Note: Set to 0 will disable memory reclamation.
    maxPacketDataSize; 150MB; utils::FileSize; Maximum packet data size.
    blockDisruptorSlotCount; 4096; uint32_t; Size of the block disruptor circular buffer.
    blockElementTraceInterval; 1; uint32_t; Multiple of elements at which a block element should be traced through queue and completion.
    blockDisruptorMaxMemorySize; 1000MB; ;
    transactionDisruptorSlotCount; 8192; uint32_t; Size of the transaction disruptor circular buffer.
    transactionElementTraceInterval; 10; uint32_t; Multiple of elements at which a transaction element should be traced through queue and completion.
    transactionDisruptorMaxMemorySize; 20MB; ;
    enableDispatcherAbortWhenFull; false; bool; Set to true if the process should terminate when any dispatcher is full.
    enableDispatcherInputAuditing; false; bool; Set to true if all dispatcher inputs should be audited.
    maxTrackedNodes; 5'000; uint32_t; Maximum number of nodes to track in memory.
    minPartnerNodeVersion; 1.0.2.0; ;
    maxPartnerNodeVersion; 1.0.255.255; ;
    trustedHosts; 127.0.0.1, 172.20.0.25; unordered_set<string>; Trusted hosts that are allowed to execute protected API calls on this node.
    localNetworks; 127.0.0.1, 172.20.0.25; unordered_set<string>; Networks that should be treated as local.
    listenInterface; 0.0.0.0; ;
    **cache_database**;
    enableStatistics; false
    maxOpenFiles; 0
    maxBackgroundThreads; 0
    maxSubcompactionThreads; 0
    blockCacheSize; 0MB
    memtableMemoryBudget; 0MB
    maxWriteBatchSize; 5MB
    maxLogFiles; 10
    maxLogFileSize; 100MB
    **localnode**; ; ;
    host; ; string; Node host (leave empty to auto-detect IP).
    friendlyName; myFriendlyName; string; Node friendly name (leave empty to use address).
    version; ; uint32_t; Node version.
    roles; Peer,Api,Voting; ionet::NodeRoles; Node roles.
    **outgoing_connections**; ; ;
    maxConnections; 10; uint16_t; Maximum number of active connections.
    maxConnectionAge; 200; uint16_t; Maximum connection age.
    maxConnectionBanAge; 20; uint16_t; Maximum connection ban age.
    numConsecutiveFailuresBeforeBanning; 3; uint16_t; Number of consecutive connection failures before a connection is banned.
    **incoming_connections**; ; ;
    maxConnections; 512; uint16_t; Maximum number of active connections.
    maxConnectionAge; 200; uint16_t; Maximum connection age.
    maxConnectionBanAge; 20; uint16_t; Maximum connection ban age.
    numConsecutiveFailuresBeforeBanning; 3; uint16_t; Number of consecutive connection failures before a connection is banned.
    backlogSize; 512; uint16_t; Maximum size of the pending connections queue.
    **banning**; ; ;
    defaultBanDuration; 12h; utils::TimeSpan; Default duration for banning.
    maxBanDuration; 12h; utils::TimeSpan; Maximum duration for banning.
    keepAliveDuration; 48h; utils::TimeSpan; Duration to keep account in container after the ban expired.
    maxBannedNodes; 5'000; uint32_t; Maximum number of banned nodes.
    numReadRateMonitoringBuckets; 4; uint16_t; Number of read rate monitoring buckets (Set to 0 to disable read rate monitoring).
    readRateMonitoringBucketDuration; 15s; utils::TimeSpan; Duration of each read rate monitoring bucket.
    maxReadRateMonitoringTotalSize; 100MB; utils::FileSize; Maximum size allowed during full read rate monitoring period.
    minTransactionFailuresCountForBan; 8; ;
    minTransactionFailuresPercentForBan; 10; ;

config-pt.properties
====================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **partialtransactions**;
    cacheMaxResponseSize; 5MB
    cacheMaxSize; 20MB

config-task.properties
======================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **logging task**;
    startDelay; 1m
    repeatDelay; 10m
    **connect peers task for service Finalization**;
    startDelay; 2s
    repeatDelay; 1m
    **finalization task**;
    startDelay; 2m
    repeatDelay; 15s
    **pull finalization messages task**;
    startDelay; 3s
    repeatDelay; 1s
    **pull finalization proof task**;
    startDelay; 10s
    repeatDelay; 50s
    **harvesting task**;
    startDelay; 30s
    repeatDelay; 1s
    **network chain height detection**;
    startDelay; 1s
    repeatDelay; 15s
    **node discovery peers task**;
    startDelay; 1m
    minDelay; 1m
    maxDelay; 10m
    numPhaseOneRounds; 10
    numTransitionRounds; 20
    **node discovery ping task**;
    startDelay; 2m
    repeatDelay; 5m
    **age peers task for service Readers**;
    startDelay; 1m
    repeatDelay; 1m
    **batch partial transaction task**;
    startDelay; 500ms
    repeatDelay; 500ms
    **connect peers task for service Pt**;
    startDelay; 3s
    repeatDelay; 1m
    **pull partial transactions task**;
    startDelay; 10s
    repeatDelay; 3s
    **batch transaction task**;
    startDelay; 500ms
    repeatDelay; 500ms
    **connect peers task for service Sync**;
    startDelay; 1s
    repeatDelay; 1m
    **pull unconfirmed transactions task**;
    startDelay; 4s
    repeatDelay; 3s
    **synchronizer task**;
    startDelay; 3s
    repeatDelay; 3s
    **time synchronization task**;
    startDelay; 1m
    minDelay; 3m
    maxDelay; 180m
    numPhaseOneRounds; 5
    numTransitionRounds; 10
    **static node refresh task**;
    startDelay; 5ms
    minDelay; 15s
    maxDelay; 24h
    numPhaseOneRounds; 20
    numTransitionRounds; 20

config-timesync.properties
==========================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **timesynchronization**;
    maxNodes; 20
    minImportance; 10'000'000'000

config-user.properties
======================
.. csv-table::
    :header: "Property", "Value"
    :delim: ;

    **account**;
    enableDelegatedHarvestersAutoDetection; true
    **storage**;
    seedDirectory; ./seed
    certificateDirectory; ./cert
    dataDirectory; ./data
    pluginsDirectory; /usr/catapult/lib
    votingKeysDirectory; ./votingkeys
