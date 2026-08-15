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
  'categories', 'tags', 'brands', 'images', 'attributes', 'variations',
  'menu_order', 'total_sales',
  'date_created', 'date_modified',
] as const

export const CATEGORY_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'parent', 'description', 'menu_order', 'count',
] as const

export const BRAND_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'description', 'count',
] as const

export const VARIATION_FIELDS = [
  'id', 'sku', 'price', 'regular_price',
  'stock_quantity', 'stock_status', 'attributes', 'image', 'menu_order',
] as const

export const CUSTOMER_FIELDS = [
  'id', 'email', 'first_name', 'last_name', 'username', 'role',
  'billing', 'shipping', 'is_paying_customer', 'date_created', 'date_modified',
] as const

/**
 * Order fields for customer ingestion. Deliberately narrow: line items are not
 * needed to build a customer list, and pulling them across 1133 orders would be
 * a much heavier request.
 */
export const ORDER_FIELDS = [
  'id', 'number', 'status', 'currency', 'total', 'customer_id',
  'billing', 'date_created', 'date_modified',
] as const

/** Comma-joined for the `_fields` query parameter. */
export function fieldParam(list: readonly string[]): string {
  return list.join(',')
}
