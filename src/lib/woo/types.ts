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
  attributes: unknown[]
  variations: number[]
  menu_order: number
  total_sales: number
  date_created: string
  date_modified: string
}

export type WooVariation = {
  id: number
  sku: string
  price: string
  regular_price: string
  stock_quantity: number | null
  stock_status: string
  attributes: unknown[]
  image: WooImage | null
  menu_order: number
}
