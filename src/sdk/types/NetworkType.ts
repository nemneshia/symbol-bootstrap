/**
 * Domain network type enum.
 * Values intentionally mirror symbol-sdk NetworkType so numeric casts are zero-cost.
 * MAIN_NET = 0x68 = 104, TEST_NET = 0x98 = 152
 */
export enum NetworkType {
  MAIN_NET = 104,
  TEST_NET = 152,
}
