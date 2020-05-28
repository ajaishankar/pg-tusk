import * as t from './tables'

import { Expr, ColumnTypes as C } from '../src'

describe('columns tests', () => {
  let columns = t.customers.columns

  it('list columns names', () => {
    expect(columns.names).toEqual(['id', 'name', 'age'])
  })

  it('list columns for select', () => {
    expect(columns.toString()).toEqual('"id", "name", "age"')
  })

  it('column alias', () => {
    expect(columns.forSelect('c')).toEqual('c."id" as "c_id", c."name" as "c_name", c."age" as "c_age"')
  })

  it('pick columns', () => {
    expect(columns.pick('id', 'name').toString()).toEqual('"id", "name"')
  })

  it('omit columns', () => {
    expect(columns.omit('age').toString()).toEqual('"id", "name"')
  })

  it('computed columns', () => {
    let computed = columns.extend({
      adult: Expr.boolean('age >= 21 then true else false end'),
    })
    expect(computed.toString()).toEqual('"id", "name", "age", age >= 21 then true else false end as "adult"')
  })

  it('computed columns aliased', () => {
    let computed = columns.extend({
      adult: Expr.boolean('c.age >= 21 then true else false end'),
    })
    expect(computed.forSelect('c')).toEqual(
      'c."id" as "c_id", c."name" as "c_name", c."age" as "c_age", c.age >= 21 then true else false end as "c_adult"',
    )
  })
})

describe('column types tests', () => {
  type A = 'A' | 'B'

  type Expected = {
    number: number
    string: string
    date: Date
    boolean: boolean
    array: number[]
    enum: A
    json: {
      foo: number
    }
  }

  // type check
  let columns: Expected = {
    number: C.number,
    string: C.string,
    date: C.date,
    boolean: C.boolean,
    array: C.array<number>(),
    enum: C.enum<A>(),
    json: C.json({
      foo: C.number,
    }),
  }

  expect(columns).toEqual({
    number: 0,
    string: '',
    date: expect.any(Date),
    boolean: false,
    array: [],
    enum: '',
    json: {
      foo: 0,
    },
  })
})
