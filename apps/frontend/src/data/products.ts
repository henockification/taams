import { CartItem } from "@/components/landing/cart-context";

export const PRODUCTS: Omit<CartItem, "quantity">[] = [
  {
    id: "1",
    name: "Premium Wireless Headphones",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "2",
    name: "Minimalist Watch",
    price: 149.50,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "3",
    name: "Analog Instant Camera",
    price: 89.99,
    image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "4",
    name: "Designer Sunglasses",
    price: 199.00,
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "5",
    name: "Leather Backpack",
    price: 129.95,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "6",
    name: "Smart Home Speaker",
    price: 79.99,
    image: "https://images.unsplash.com/photo-1589492477829-5e65395b66cc?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "7",
    name: "Ceramic Coffee Set",
    price: 45.00,
    image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "8",
    name: "Mechanical Keyboard",
    price: 159.99,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b91a603?q=80&w=1000&auto=format&fit=crop",
  },
];

export function getProductById(id: string) {
  return PRODUCTS.find((product) => product.id === id);
}
