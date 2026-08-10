export { ProductsPage } from './pages/ProductsPage'
export type {
  Product,
  ProductInput,
  ProductUnit,
  ProductType,
  ProductBarcodeMeta,
  BarcodeType,
  BarcodeSource,
  PrepStation,
} from './types'
export {
  normalizeProductText,
  BARCODE_TYPES,
  BARCODE_SOURCES,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  PREP_STATIONS,
  PREP_STATION_LABELS,
  productTracksOwnStock,
  defaultPrepStationForType,
} from './types'
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
  doseConsumeMl,
  doseConsumeStockUnits,
  doseCostCentsFromBase,
  assertDoseProductReady,
  formatBottleStockLabel,
  formatProductStockLabel,
  usesBottleStockModel,
  readBottleStock,
  resolveLinkedDoseMl,
  dosesFromMl,
  applyBottleConsume,
  applyBottleRestore,
  DEFAULT_YIELD_PERCENT,
} from './services/dose-service'
export {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './services/category-service'
export type { ProductCategory, ProductCategoryInput } from './types/category'
export {
  generateBalqoInternalBarcode,
  productHasBarcode,
  buildBarcodeMeta,
} from './services/barcode-service'
