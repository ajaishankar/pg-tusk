/* eslint-disable @typescript-eslint/camelcase */

import * as t from './tables'
import { join, JoinColumns } from '../src'

describe('join tests', () => {
  let customersWithOrders = join(t.customers.columns, {
    as: 'c',
    pk: ['id'],
    orders: join(t.orders.columns.omit('customer_id'), {
      as: 'o',
      pk: 'id',
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

  it('should return instance of join columns', () => {
    expect(customersWithOrders).toBeInstanceOf(JoinColumns)
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
    expect(customersWithOrders.toString()).toEqual(
      [
        'c."id" as "c_id", c."name" as "c_name", c."age" as "c_age", ',
        'o."id" as "o_id", o."date" as "o_date", o."status" as "o_status", o."total" as "o_total", ',
        'i."id" as "i_id", i."price" as "i_price", i."quantity" as "i_quantity", i."total" as "i_total", ',
        'p."id" as "p_id", p."name" as "p_name"',
      ].join(''),
    )
  })

  it('cannot join without columns alias', () => {
    expect(() => join(t.customers.columns, { as: '', pk: 'id' })).toThrow()
  })
})
