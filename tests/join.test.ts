/* eslint-disable @typescript-eslint/camelcase */

import * as t from './tables'

import { JoinTable, JoinTableSchema, Expr, sql } from '../src'

describe('join tests', () => {
  const customersWithOrders = t.customers.join({
    as: 'c',
    pk: ['id'],
    extend: {
      adult: Expr.boolean('case when c.age >= 21 then true else false end'),
    },
    orders: t.orders.join({
      as: 'o',
      pk: 'id',
      on: 'o.customer_id = c.id',
      omit: ['customer_id'],
      items: t.order_items.join({
        as: 'i',
        pk: 'id',
        on: 'i.order_id = o.id',
        omit: ['order_id', 'product_id'],
        product: t.products.leftJoin({
          as: 'p',
          pk: 'id',
          on: 'i.product_id = p.id',
          single: true, // product is an object, not array
        }),
      }),
    }),
  })

  type CustomerWithOrders = JoinTableSchema<typeof customersWithOrders>

  it('should return instance of join columns', () => {
    expect(customersWithOrders).toBeInstanceOf(JoinTable)
  })

  it('should return expected schema', () => {
    type Expected = {
      id: number
      name: string
      age: number
      adult: boolean
      orders: {
        id: number
        date: Date
        status: t.OrderStatus
        total: number
        items: {
          id: number
          total: number
          price: number
          quantity: number
          product: {
            id: number
            name: string
          }
        }[]
      }[]
    }

    type M1 = CustomerWithOrders extends Expected ? true : false
    type M2 = Expected extends CustomerWithOrders ? true : false

    // if schema does not match exactly, the following should give compile time error
    const match1: M1 = true
    const match2: M2 = true

    expect(match1).toBe(true)
    expect(match2).toBe(true)
  })

  /**
   * https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition
   */
  it('should build schema for massivejs decompose', () => {
    expect(customersWithOrders.schema).toEqual({
      pk: ['c_id'],
      columns: {
        c_id: 'id',
        c_name: 'name',
        c_age: 'age',
        c_adult: 'adult',
      },
      decomposeTo: 'array',
      orders: {
        pk: ['o_id'],
        columns: {
          o_id: 'id',
          o_date: 'date',
          o_status: 'status',
          o_total: 'total',
        },
        decomposeTo: 'array',
        items: {
          pk: ['i_id'],
          columns: {
            i_id: 'id',
            i_price: 'price',
            i_quantity: 'quantity',
            i_total: 'total',
          },
          decomposeTo: 'array',
          product: {
            pk: ['p_id'],
            columns: {
              p_id: 'id',
              p_name: 'name',
            },
            decomposeTo: 'object',
          },
        },
      },
    })
  })

  it('should build column list for select', () => {
    expect(customersWithOrders.columns.toString()).toEqual(
      [
        'c."id" as "c_id", c."name" as "c_name", c."age" as "c_age", ',
        'case when c.age >= 21 then true else false end as "c_adult", ',
        'o."id" as "o_id", o."date" as "o_date", o."status" as "o_status", o."total" as "o_total", ',
        'i."id" as "i_id", i."price" as "i_price", i."quantity" as "i_quantity", i."total" as "i_total", ',
        'p."id" as "p_id", p."name" as "p_name"',
      ].join(''),
    )
  })

  it('should build join clause', () => {
    expect(customersWithOrders.toString()).toEqual(
      [
        '"customers" c ',
        'inner join "orders" o on o.customer_id = c.id ',
        'inner join "order_items" i on i.order_id = o.id ',
        'left outer join "products" p on i.product_id = p.id ',
      ].join(''),
    )
  })

  it('cannot join without columns alias', () => {
    expect(() => t.customers.join({ as: '', pk: 'id' })).toThrow()
  })

  it('should not be parameterized if embedded in custom sql', () => {
    let query = sql`select ${customersWithOrders.columns} from ${customersWithOrders}`
    expect(query.values.length).toBe(0)
  })
})
