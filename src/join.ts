import * as _ from 'lodash'

import { ElementType, ExpandRecursively, TableBase } from './base'
import { Columns } from './columns'

import * as decompose from './massive/util/decompose'
import { SqlUnsafeString } from './sql'
import { Computed, Extend } from './expr'

export type Join<T, X extends object> = {
  as: string
  pk: keyof T | (keyof T)[]
  omit?: (keyof T)[]
  extend?: Computed<X>
  on?: string
  single?: true
}

type ExcludeKeys = 'as' | 'pk' | 'omit' | 'extend' | 'on' | 'single'

export type Joinable<O> = O extends Join<infer _, infer __>
  ? O &
      {
        [K in Exclude<keyof O, ExcludeKeys>]: O[K] extends JoinTable<infer _> ? O[K] : never
      }
  : never

type _OmitColumns<_T, K extends string> = { omit: K[] } // not sure why K extends keyof T doesn't work here

type OmitColumns<T, O> = O extends _OmitColumns<T, infer K> ? Omit<T, K> : T

type ExtendColumns<T, O> = O extends { extend: Computed<infer X> } ? Extend<T, X> : T

type _JoinResult<T, O> = ExpandRecursively<
  ExtendColumns<OmitColumns<T, O>, O> &
    {
      [K in Exclude<keyof O, ExcludeKeys>]: O[K] extends JoinTable<infer R> ? R : never
    }
>

type JoinResult<T, O> = O extends { single: true } ? _JoinResult<T, O> : _JoinResult<T, O>[]

type DecomposeSchema = {
  pk: string[]
  columns: { [key: string]: string }
  decomposeTo: 'object' | 'array'
  [nested: string]: DecomposeSchema | any
}

export class JoinTable<R = any> extends TableBase {
  private constructor(readonly schema: DecomposeSchema, readonly columns: SqlUnsafeString, private joinClause: string) {
    super()
  }

  decompose(rows: any[]) {
    return decompose(this.schema as any, rows) as ElementType<R>[]
  }

  toString() {
    return this.joinClause
  }

  /**
   * https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition
   */
  static create<T extends object, X extends object, O extends Join<T, X>>(
    type: 'inner' | 'left outer',
    left: { name: string; columns: Columns<T> },
    right: Joinable<O>,
  ) {
    let { as, pk, single, omit, extend, on, ...joins } = (right as unknown) as Join<T, X> & {
      [nested: string]: JoinTable
    }

    let alias = _.trim(as)

    if (!alias.length) {
      throw new Error('Columns need to be aliased for join')
    }

    let columns = omit != null ? left.columns.omit(...omit) : left.columns

    if (extend != null) {
      columns = columns.extend(extend)
    }

    let nested = {
      columns: _.values(joins).map(tbl => tbl.columns),
      clauses: _.values(joins).map(tbl => tbl.joinClause),
      schema: _.mapValues(joins, (tbl: JoinTable) => tbl.schema),
    }

    let joinColumns = [columns.forSelect(alias), ...nested.columns].join(', ')
    let joinTable = _.trim(on).length ? `${type} join ${left.name} ${alias} on ${on}` : `${left.name} ${alias}`
    let joinClause = [joinTable, nested.clauses].join(' ')

    let schema: DecomposeSchema = {
      pk: _.castArray(pk).map(key => `${alias}_${key}`),
      columns: _.keyBy(columns.names, col => `${alias}_${col}`),
      decomposeTo: single ? 'object' : 'array',
      ...nested.schema,
    }

    return new JoinTable<JoinResult<T, O>>(schema, new SqlUnsafeString(joinColumns), joinClause)
  }
}

export type JoinTableSchema<J> = J extends JoinTable<infer T> ? ElementType<T> : never
