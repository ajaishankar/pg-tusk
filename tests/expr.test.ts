import * as _ from 'lodash'

import { Expr } from '../src'

describe('expr tests', () => {
  type A = 'a' | 'b'
  type B = { foo: string }

  let object = {
    number: Expr.number('number'),
    string: Expr.string('string'),
    enum: Expr.enum<A>('A'),
    date: Expr.date('date'),
    boolean: Expr.boolean('boolean'),
    any: Expr.any<B>('B'),
  }

  it('should return Expr instance', () => {
    _.values(object).forEach(value => expect(value).toBeInstanceOf(Expr))

    let mapped = _.mapValues(object, value => value.toString())

    expect(mapped).toEqual({
      number: 'number',
      string: 'string',
      enum: 'A',
      date: 'date',
      boolean: 'boolean',
      any: 'B',
    })
  })
})
