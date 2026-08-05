export { localDb, type SyncQueueItem, type CachedProduct, type CachedCustomer } from './db'
export {
  enqueueOperation,
  listPendingOperations,
  countPendingOperations,
  removeQueueItem,
  markQueueError,
  resetQueueItem,
} from './queue'
export {
  cacheProducts,
  listCachedProducts,
  getCachedProduct,
  adjustCachedStock,
  cachedToProduct,
} from './product-cache'
export {
  saveLocalSale,
  markLocalSaleSynced,
  listLocalSales,
  countPendingSales,
  saveLocalCashSession,
  getLocalOpenCashSession,
  markLocalCashSynced,
  listLocalCashSessions,
  updateLocalCashSessionFields,
  listLocalSalesForCashSession,
} from './local-records'
export {
  isOnline,
  type SaleCreateQueuePayload,
  type CashOpenQueuePayload,
  type CashCloseQueuePayload,
} from './types'
export { LOCAL_DB_VERSION, describeLocalMigrations } from './migrations'
