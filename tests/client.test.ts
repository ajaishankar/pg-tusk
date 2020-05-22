/* eslint-disable @typescript-eslint/camelcase */

import { getTestDatabase } from './db'
import * as t from './tables'
import { Order } from './tables'
import { Client, sql, from, join, JoinColumnsSchema, Expr } from '../src'

/**
 * https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition
 */
const customersWithOrders = join(t.customers.columns, {
  as: 'c',
  pk: 'id',
  orders: join(t.orders.columns.omit('customer_id'), {
    as: 'o',
    pk: ['id'],
    items: join(t.order_items.columns.omit('order_id', 'product_id'), {
      as: 'i',
      pk: 'id',
      product: join(t.products.columns, {
        as: 'p',
        pk: 'id',
        single: true, // product is an object, not array
      }),
    }),
  }),
})

type CustomerWithOrders = JoinColumnsSchema<typeof customersWithOrders>

const db = getTestDatabase()

describe('client tests', () => {
  let client: Client

  const date1 = new Date('2020-05-20')
  const date2 = new Date('2020-05-21')

  beforeEach(async () => {
    client = await db.getClient()

    let [product1, product2] = await t.products.insert(client, [{ name: 'product 1' }, { name: 'product 2' }])

    let customer = await t.customers.insert(client, { name: 'john doe', age: 30 })

    let [order1, order2] = await t.orders.insert(client, [
      { customer_id: customer.id, date: date1, status: 'shipped', total: 42 },
      { customer_id: customer.id, date: date2, status: 'ordered', total: 20 },
    ])

    await t.order_items.insert(client, [
      { order_id: order1.id, product_id: product1.id, price: 11, quantity: 2, total: 22 },
      { order_id: order1.id, product_id: product2.id, price: 20, quantity: 1, total: 20 },
      { order_id: order2.id, product_id: product2.id, price: 20, quantity: 1, total: 20 },
    ])
  })

  it('can run select query', async () => {
    // test embed too just for fun
    let filter = sql.embed`date = ${date2}`
    let result = await client.query<Order>(sql`select ${t.orders.columns} from orders where ${filter}`)

    expect(result.rowCount).toBe(1)
    expect(result.rows.length).toBe(1)
    expect(result.rows[0]).toMatchObject({ date: date2, status: 'ordered', total: 20 })
  })

  it('can run update query', async () => {
    let [oldStatus, newStatus] = ['ordered', 'shipped']
    let result = await client.query(sql`update orders set status = ${newStatus} where status = ${oldStatus}`)
    expect(result.rowCount).toBe(1)
  })

  it('can run within transaction', async () => {
    let result = await client.withTransaction(async () => {
      let [oldStatus, newStatus] = ['ordered', 'shipped']
      return await client.query(sql`update orders set status = ${newStatus} where status = ${oldStatus}`)
    })
    expect(result.rowCount).toBe(1)
  })

  it('can select columns specified in sql', async () => {
    let orders = await client.select(
      t.orders.columns,
      sql`select ${t.orders.columns} from orders where date = ${date2}`,
    )
    expect(orders.length).toBe(1)
    expect(orders[0]).toMatchObject({ date: date2, status: 'ordered', total: 20 })
  })

  it('can select columns from', async () => {
    let orders = await client.select(t.orders.columns, from`orders where date = ${date2}`)
    expect(orders.length).toBe(1)
    expect(orders[0]).toMatchObject({ date: date2, status: 'ordered', total: 20 })
  })

  it('can select computed columns', async () => {
    let columns = t.customers.columns.extend({
      adult: Expr.boolean('case when age >= 21 then true else false end'),
    })
    let customers = await client.select(columns, from`customers`)

    expect(customers.length).toBe(1)
    expect(customers[0].adult).toBe(true)
  })

  it('can select joined columns', async () => {
    // ensure compatible type
    let customers: CustomerWithOrders[] = await client.select(
      customersWithOrders,
      from`
        customers c
        join orders o
          on o.customer_id = c.id
        join order_items i
          on i.order_id = o.id
        join products p
          on i.product_id = p.id
        order by o.id, i.id`,
    )

    expect(customers.length).toBe(1)

    // strongly typed FTW!
    expect(customers[0].orders[0].items[0].product.name).toEqual('product 1')

    const id = expect.any(Number)

    expect(customers[0]).toEqual({
      id: id,
      name: 'john doe',
      age: 30,
      orders: [
        {
          id: id,
          date: date1,
          status: 'shipped',
          total: 42,
          items: [
            { id: id, price: 11, quantity: 2, total: 22, product: { id: id, name: 'product 1' } },
            { id: id, price: 20, quantity: 1, total: 20, product: { id: id, name: 'product 2' } },
          ],
        },
        {
          id: id,
          date: date2,
          status: 'ordered',
          total: 20,
          items: [{ id: id, price: 20, quantity: 1, total: 20, product: { id: id, name: 'product 2' } }],
        },
      ],
    })
  })
})
