export { ProductsPage } from './pages/ProductsPage'
export type { Product, ProductInput, ProductUnit, ProductType } from './types'
export { normalizeProductText } from './types'
export {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductActive,
  filterProducts,
  findProductByBarcode,
} from './services/product-service'
