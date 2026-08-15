/**
 * mylens.gr throws a PHP fatal error (HTTP 500) when any of these are requested.
 * Verified by bisection on 2026-08-15. A plugin hooking WooCommerce sale-price
 * display is the cause; it is unfixed on the WordPress side.
 *
 * Sale state is derived locally instead: onSale = price < regularPrice.
 */
export const FORBIDDEN_FIELDS = ['sale_price', 'on_sale', 'price_html'] as const

export const PRODUCT_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'permalink', 'sku', 'type', 'status', 'featured',
  'description', 'short_description',
  'price', 'regular_price',
  'manage_stock', 'stock_quantity', 'stock_status',
  'categories', 'tags', 'images', 'attributes', 'variations',
  'menu_order', 'total_sales',
  'date_created', 'date_modified',
] as const

export const CATEGORY_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'parent', 'description', 'menu_order', 'count',
] as const

export const VARIATION_FIELDS = [
  'id', 'sku', 'price', 'regular_price',
  'stock_quantity', 'stock_status', 'attributes', 'image', 'menu_order',
] as const

/** Comma-joined for the `_fields` query parameter. */
export function fieldParam(list: readonly string[]): string {
  return list.join(',')
}
