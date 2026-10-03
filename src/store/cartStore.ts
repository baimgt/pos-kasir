import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CartItem, Product } from '@/types'

interface CartStore {
  items: CartItem[]
  discount: number
  discountType: 'PERCENTAGE' | 'FIXED'
  notes: string
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setDiscount: (discount: number, type?: 'PERCENTAGE' | 'FIXED') => void
  setNotes: (notes: string) => void
  getSubtotal: () => number
  getDiscountAmount: (subtotal?: number) => number
  getTaxAmount: (subtotal?: number, taxPercentage?: number) => number
  getTotal: (taxPercentage?: number) => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      discountType: 'FIXED',
      notes: '',

      addItem: (product: Product) => {
        const { items } = get()
        const existingItem = items.find((item) => item.productId === product._id)

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.productId === product._id
                ? {
                    ...item,
                    quantity: item.quantity + 1,
                    subtotal: (item.quantity + 1) * item.price,
                  }
                : item
            ),
          })
        } else {
          set({
            items: [
              ...items,
              {
                productId: product._id,
                productName: product.name,
                productImage: product.image,
                price: product.price,
                quantity: 1,
                subtotal: product.price,
              },
            ],
          })
        }
      },

      removeItem: (productId: string) => {
        set({ items: get().items.filter((item) => item.productId !== productId) })
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map((item) =>
            item.productId === productId
              ? { ...item, quantity, subtotal: quantity * item.price }
              : item
          ),
        })
      },

      clearCart: () => {
        set({ items: [], discount: 0, discountType: 'FIXED', notes: '' })
      },

      setDiscount: (discount: number, type: 'PERCENTAGE' | 'FIXED' = 'FIXED') => {
        set({ discount, discountType: type })
      },

      setNotes: (notes: string) => {
        set({ notes })
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.subtotal, 0)
      },

      getDiscountAmount: (subtotal?: number) => {
        const sub = subtotal ?? get().getSubtotal()
        const { discount, discountType } = get()
        if (discountType === 'PERCENTAGE') {
          return Math.round(sub * (discount / 100))
        }
        return Math.min(discount, sub)
      },

      getTaxAmount: (subtotal?: number, taxPercentage?: number) => {
        const sub = subtotal ?? get().getSubtotal()
        const discountAmount = get().getDiscountAmount(sub)
        const taxableAmount = sub - discountAmount
        const taxPct = taxPercentage ?? 0
        return Math.round(taxableAmount * (taxPct / 100))
      },

      getTotal: (taxPercentage?: number) => {
        const subtotal = get().getSubtotal()
        const discountAmount = get().getDiscountAmount(subtotal)
        const taxAmount = get().getTaxAmount(subtotal, taxPercentage)
        return subtotal - discountAmount + taxAmount
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },
    }),
    {
      name: 'pos-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
