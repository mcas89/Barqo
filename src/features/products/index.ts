export { ProductsPage } from './pages/ProductsPage'
export type {
  Product,
  ProductInput,
  ProductUnit,
  ProductType,
  ProductBarcodeMeta,
  BarcodeType,
  BarcodeSource,
} from './types'
export { normalizeProductText, BARCODE_TYPES, BARCODE_SOURCES } from './types'
export {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductActive,
  filterProducts,
  findProductByBarcode,
  generateInternalBarcodeForProduct,
  generateMissingBarcodes,
  setProductBarcode,
} from './services/product-service'
export {
  generateBalqoInternalBarcode,
  productHasBarcode,
  buildBarcodeMeta,
} from './services/barcode-service'
