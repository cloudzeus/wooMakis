export type WooTranslations = Record<string, number>

export type WooImage = {
  id: number
  src: string
  name?: string
  alt?: string
}

export type WooTermRef = { id: number; name: string; slug: string }

export type WooCategory = {
  id: number
  lang: string
  translations: WooTranslations
  name: string
  slug: string
  parent: number
  description: string
  menu_order: number
  count: number
}

export type WooBrand = {
  id: number
  lang: string
  translations: WooTranslations
  name: string
  slug: string
  description: string
  count: number
}

export type WooProductAttribute = {
  id: number
  name: string
  slug?: string
  position?: number
  visible?: boolean
  variation?: boolean
  options?: string[]
}

export type WooProduct = {
  id: number
  lang: string
  translations: WooTranslations
  name: string
  slug: string
  permalink: string
  sku: string
  type: string
  status: string
  featured: boolean
  description: string
  short_description: string
  price: string
  regular_price: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: string
  categories: WooTermRef[]
  tags: WooTermRef[]
  images: WooImage[]
  attributes: WooProductAttribute[]
  brands?: WooTermRef[]
  variations: number[]
  menu_order: number
  /** The live site returns this as a string ("0") for some posts, a number for others. */
  total_sales: number | string
  date_created: string
  date_modified: string
}

export type WooVariationAttribute = { id: number; name: string; slug?: string; option: string }

export type WooVariation = {
  id: number
  sku: string
  price: string
  regular_price: string
  stock_quantity: number | null
  stock_status: string
  attributes: WooVariationAttribute[]
  image: WooImage | null
  menu_order: number
}

export type WooAddress = {
  first_name?: string
  last_name?: string
  company?: string
  address_1?: string
  address_2?: string
  city?: string
  postcode?: string
  country?: string
  state?: string
  email?: string
  phone?: string
}

export type WooCustomer = {
  id: number
  email: string
  first_name?: string
  last_name?: string
  username?: string
  role?: string
  billing?: WooAddress
  shipping?: WooAddress
  is_paying_customer?: boolean
  date_created?: string
  date_modified?: string
}

export type WooOrderLine = {
  id: number
  name?: string
  sku?: string
  product_id?: number
  variation_id?: number
  quantity?: number
  subtotal?: string
  total?: string
  /**
   * The prescription. This shop models lens power as a plain attribute rather
   * than a variation, so the customer's choice lives here and nowhere else.
   * Keys prefixed with "_" are WooCommerce internals and are dropped on pull.
   */
  meta_data?: { key: string; display_key?: string; value: unknown; display_value?: unknown }[]
}

export type WooOrder = {
  id: number
  number?: string
  status?: string
  currency?: string
  total?: string
  total_tax?: string
  shipping_total?: string
  discount_total?: string
  payment_method?: string
  payment_method_title?: string
  transaction_id?: string
  customer_id?: number
  customer_note?: string
  billing?: WooAddress
  shipping?: WooAddress
  line_items?: WooOrderLine[]
  date_paid?: string | null
  date_created?: string
  date_modified?: string
}
