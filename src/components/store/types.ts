/** Serialisable product shape shared by the storefront grid, card and quick view. */
export type StoreProduct = {
  id: string
  name: string
  nameEn: string | null
  slug: string
  sku: string | null
  brand: string | null
  categories: string[]
  price: number | null
  regularPrice: number | null
  onSale: boolean
  stockStatus: string
  type: string
  shortDescription: string | null
  description: string | null
  permalink: string | null
  images: { url: string; alt: string | null }[]
  attributes: { name: string; options: string[] }[]
  variationCount: number
}
