export { InventoryPage } from './pages/InventoryPage'
export {
  listInventoryProducts,
  listStockMovements,
  registerStockEntry,
  registerStockLoss,
  registerStockAdjustment,
  isLowStock,
  filterInventoryProducts,
} from './services/inventory-service'
export type {
  StockMovement,
  StockMovementType,
  StockEntryInput,
  StockAdjustmentInput,
  StockLossInput,
} from './types'
export {
  STOCK_MOVEMENT_TYPES,
  STOCK_MOVEMENT_LABELS,
} from './types'
