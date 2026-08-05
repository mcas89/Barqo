export { CashRegisterPage } from './pages/CashRegisterPage'
export type { CashSession, CashSummary, CashMovement } from './types'
export {
  getOpenCashSession,
  openCashSession,
  addCashMovement,
  closeCashSession,
  buildCashSummary,
  listSalesSince,
  listSalesByCashSession,
} from './services/cash-service'
