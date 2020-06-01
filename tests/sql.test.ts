import * as t from './tables'
import { sql, EmbeddedSql, where, from, Expr } from '../src'

describe('sql template literals', () => {
  let age = 25
  let name = 'doe'

  it('should return parametrized query config', () => {
    expect(sql`select * from customers where age > ${age} and name = ${name}`).toEqual({
      text: 'select * from customers where age > $1 and name = $2',
      values: [age, name],
    })
  })

  it('should not parameterize tables or columns', () => {
    expect(sql`select ${t.customers.columns} from ${t.customers} where age > ${age}`).toEqual({
      text: 'select "id", "name", "age" from "customers" where age > $1',
      values: [age],
    })
  })

  it('should not parameterize sql unsafe string', () => {
    let limit = sql.unsafe`limit ${10}`

    expect(sql`select * from customers where age > ${age} order by name ${limit}`).toEqual({
      text: 'select * from customers where age > $1 order by name limit 10',
      values: [age],
    })
  })

  it('should parametrize embedded sql', () => {
    let filter = sql.embed`age > ${age}`

    expect(filter).toBeInstanceOf(EmbeddedSql)

    expect(sql`select * from customers where ${filter}`).toEqual({
      text: 'select * from customers where age > $1',
      values: [age],
    })
  })

  it('should not parametrize expression', () => {
    let adult = Expr.boolean('case when age >= 21 then true else false end')

    expect(sql`select *, ${adult} as adult from customers`).toEqual({
      text: 'select *, case when age >= 21 then true else false end as adult from customers',
      values: [],
    })
  })

  it('should handle repeated params', () => {
    expect(sql`select * from customers where age between ${age} and ${age} + 10`).toEqual({
      text: 'select * from customers where age between $1 and $1 + 10',
      values: [age],
    })
  })

  it('where should add where prefix', () => {
    expect(where`age > ${age}`).toEqual({
      type: 'where',
      text: ' where age > $1',
      values: [age],
    })
  })

  it('from should add from prefix', () => {
    expect(from`customers where age > ${age}`).toEqual({
      type: 'from',
      text: ' from customers where age > $1',
      values: [age],
    })
  })
})
