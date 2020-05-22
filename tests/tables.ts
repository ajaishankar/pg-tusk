/* eslint-disable @typescript-eslint/camelcase */
import { table, ColumnTypes as C, TableSchema } from '../src'

export type OrderStatus = 'ordered' | 'shipped' | 'delivered'

export const products = table('products', {
  id: C.number,
  name: C.string,
})

export const customers = table('customers', {
  id: C.number,
  name: C.string,
  age: C.number,
})

export const orders = table('orders', {
  id: C.number,
  customer_id: C.number,
  date: C.date,
  status: C.enum<OrderStatus>(),
  total: C.number,
})

export const order_items = table('order_items', {
  id: C.number,
  order_id: C.number,
  product_id: C.number,
  price: C.number,
  quantity: C.number,
  total: C.number,
})

export type Product = TableSchema<typeof products>
export type Customer = TableSchema<typeof customers>
export type Order = TableSchema<typeof orders>
export type OrderItem = TableSchema<typeof order_items>
