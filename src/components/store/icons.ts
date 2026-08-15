/**
 * The storefront's single icon family: Phosphor, regular weight, one size scale.
 *
 * Re-exported from here so the family and weight stay consistent and nobody
 * reaches for a second library or hand-draws an SVG path. Text characters such
 * as ✕ ✦ → − are not icons; they render differently per platform font and
 * cannot be styled as a set.
 */
export {
  ArrowRight,
  ArrowUpRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Minus,
  Plus,
  MagnifyingGlass,
  ShoppingBagOpen,
  SignIn,
  Sparkle,
  Truck,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'

/** One size scale. Do not introduce intermediate values. */
export const ICON_SM = 16
export const ICON_MD = 20
export const ICON_LG = 24
