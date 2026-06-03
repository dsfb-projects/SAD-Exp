const BASE = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export const api = {
  // Stats
  stats: () => req<Stats>('GET', '/stats'),

  // Products
  listProducts: () => req<Product[]>('GET', '/products'),
  createProduct: (d: ProductInput) => req<Product>('POST', '/products', d),
  updateProduct: (id: number, d: ProductInput) => req<Product>('PUT', `/products/${id}`, d),
  deleteProduct: (id: number) => req<{ok:boolean}>('DELETE', `/products/${id}`),

  // Trucks
  listTrucks: () => req<Truck[]>('GET', '/trucks'),
  createTruck: (d: TruckInput) => req<Truck>('POST', '/trucks', d),
  updateTruck: (id: number, d: TruckInput) => req<Truck>('PUT', `/trucks/${id}`, d),
  deleteTruck: (id: number) => req<{ok:boolean}>('DELETE', `/trucks/${id}`),

  // Orders
  listOrders: () => req<Order[]>('GET', '/orders'),
  createOrder: (d: OrderInput) => req<Order>('POST', '/orders', d),
  updateOrder: (id: number, d: OrderInput) => req<Order>('PUT', `/orders/${id}`, d),
  deleteOrder: (id: number) => req<{ok:boolean}>('DELETE', `/orders/${id}`),

  // Import
  importProductsExcel: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return fetch(`${BASE}/import/products`, { method: 'POST', body: fd }).then(r => r.json())
  },
  importOrdersExcel: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return fetch(`${BASE}/import/orders`, { method: 'POST', body: fd }).then(r => r.json())
  },

  // Calculate
  calculate: (d: CalcInput) => req<CalcResult>('POST', '/calculate', d),
}

export interface Stats {
  products: number; trucks: number; orders: number; total_fleet_area: number
}
export interface Product {
  id: number; codigo: number; item: string; nome: string
  area_m2: number; peso_kg: number; empilhavel: boolean; created_at: string
}
export type ProductInput = Omit<Product, 'id'|'created_at'>

export interface Truck {
  id: number; id_carreta: string; area_base_m2: number; created_at: string
}
export type TruckInput = Omit<Truck, 'id'|'created_at'>

export interface Order {
  id: number; num_venda: string; cliente: string
  produtos: Record<string, number>; created_at: string
}
export type OrderInput = Omit<Order, 'id'|'created_at'>

export interface CalcInput {
  qtd_bancos: number
  order_ids?: number[]
  use_all_orders?: boolean
}

export interface CargoItem {
  tipo: string; descricao?: string; nome?: string
  num_venda?: string; cliente?: string
  quantidade: number; peso: number; empilhavel?: boolean
}
export interface TruckResult {
  veiculo: string; area_livre: number
  peso_acumulado: number; historico_cargas: CargoItem[]
}
export interface CalcResult {
  trucks_used: number; trucks: TruckResult[]; warnings: string[]
}
