import * as _ from 'lodash'

import { Expr } from './expr'

import { ColumnsBase, ExpandRecursively } from './base'

// don't allow array for json
type Json<T> = T extends object ? (T extends (infer _)[] ? never : T) : never

type Computed<O extends object> = {
  [K in keyof O]: O[K] extends Expr<infer _> ? O[K] : never
}

type Extend<T, O extends object> = ExpandRecursively<
  T &
    {
      [K in keyof O]: O[K] extends Expr<infer T> ? T : never
    }
>

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
  // TODO: could not get the following to typecheck correctly in 3.9.2 vscode
  // let x = ColumnTypes.nullable.number returns type number instead of number | null
  // nullable: {
  //   number: 0 as number | null,
  // },
}

export class Columns<T extends object> extends ColumnsBase {
  private str: string
  readonly names: string[]

  constructor(private template: T, readonly alias = '') {
    super()
    this.names = _.keys(this.template)
    this.str = this.names
      .map(col => {
        let name = this.alias ? `"${this.alias}_${col}"` : `"${col}"`

        let value = this.template[col as keyof T]
        let expr = value instanceof Expr ? value.toString() : this.alias ? `${this.alias}."${col}"` : `"${col}"`

        return expr === name ? name : `${expr} as ${name}`
      })
      .join(', ')
  }

  extend<O extends object>(other: Computed<O>) {
    let template = { ...this.template, ...other }
    return new Columns(template as Extend<T, O>, this.alias)
  }

  as(alias: string) {
    return new Columns(this.template, alias)
  }

  pick<S extends keyof T>(...keys: S[]) {
    let template = _.pick(this.template, keys)
    return new Columns(template, this.alias)
  }

  omit<S extends keyof T>(...keys: S[]) {
    let template = _.omit(this.template, keys)
    return new Columns(template, this.alias)
  }

  toString() {
    return this.str
  }
}

export type ColumnSchema<U> = U extends Columns<infer T> ? T : never
