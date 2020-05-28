import * as _ from 'lodash'

import { Expr, Computed, Extend } from './expr'

import { ColumnsBase } from './base'

// don't allow array for json
type Json<T> = T extends object ? (T extends (infer _)[] ? never : T) : never

export const ColumnTypes = {
  number: 0,
  string: '',
  date: new Date(),
  boolean: false,
  array<T extends number | boolean | string | Date>() {
    return ([] as any) as T[]
  },
  enum<T extends string>() {
    return '' as T
  },
  /**
   * A json column (array of json objects is not allowed)
   *
   * https://github.com/brianc/node-postgres/issues/442
   */
  json<T>(value: Json<T>) {
    return value
  },
  // TODO: nullable columns?
  // could not get the following to typecheck correctly in 3.9.2 vscode
  // let x = ColumnTypes.nullable.number returns type number instead of number | null
  // nullable: {
  //   number: 0 as number | null,
  // },
}

export class Columns<T extends object> extends ColumnsBase {
  private str: string
  readonly names: string[]

  constructor(private template: T) {
    super()
    this.names = _.keys(this.template)
    this.str = this.forSelect()
  }

  extend<O extends object>(other: Computed<O>) {
    let template = { ...this.template, ...other }
    return new Columns(template as Extend<T, O>)
  }

  pick<S extends keyof T>(...keys: S[]) {
    let template = _.pick(this.template, keys)
    return new Columns(template)
  }

  omit<S extends keyof T>(...keys: S[]) {
    let template = _.omit(this.template, keys)
    return new Columns(template)
  }

  toString() {
    return this.str
  }

  forSelect(alias?: string) {
    return _.keys(this.template)
      .map(col => {
        let name = alias ? `"${alias}_${col}"` : `"${col}"`

        let value = this.template[col as keyof T]
        let expr = value instanceof Expr ? value.toString() : alias ? `${alias}."${col}"` : `"${col}"`

        return expr === name ? name : `${expr} as ${name}`
      })
      .join(', ')
  }
}

export type ColumnSchema<U> = U extends Columns<infer T> ? T : never
