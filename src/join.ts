import * as _ from 'lodash'

import { Columns } from './columns'
import { ColumnsBase, ElementType, ExpandRecursively } from './base'

type Join<T> = {
  as: string
  pk: keyof T | (keyof T)[]
  single?: true
}

type Joinable<O> = O extends Join<infer _>
  ? O &
      {
        [K in Exclude<keyof O, 'as' | 'pk' | 'single'>]: O[K] extends JoinColumns<infer _> ? O[K] : never
      }
  : never

type _JoinResult<T, O> = ExpandRecursively<
  T &
    {
      [K in Exclude<keyof O, 'as' | 'pk' | 'single'>]: O[K] extends JoinColumns<infer R> ? R : never
    }
>

type JoinResult<T, O> = O extends { single: true } ? _JoinResult<T, O> : _JoinResult<T, O>[]

type DecomposeSchema = {
  pk: string[]
  columns: { [key: string]: string }
  decomposeTo: 'object' | 'array'
  [nested: string]: DecomposeSchema | any
}

export class JoinColumns<_T = any> extends ColumnsBase {
  constructor(readonly decomposeSchema: DecomposeSchema, private columns: string) {
    super()
  }

  toString() {
    return this.columns
  }
}

export type JoinColumnsSchema<J> = J extends JoinColumns<infer T> ? ElementType<T> : never

/**
 * Builds the schema for massivejs decompose
 *
 * https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition
 */
export function join<T extends object, O extends Join<T>>(columns: Columns<T>, other: Joinable<O>) {
  let { as, pk, single, ...joins } = (other as unknown) as Join<T> & { [nested: string]: JoinColumns }

  let alias = _.trim(as)

  if (!alias.length) {
    throw new Error('Columns need to be aliased for join')
  }

  columns = columns.as(alias)

  let prefix = alias + '_'

  let nested = {
    selects: _.values(joins).map(col => col.toString()),
    decompose: _.mapValues(joins, (col: JoinColumns) => col.decomposeSchema),
  }

  let select = [columns.toString(), ...nested.selects].join(', ')

  let decompose: DecomposeSchema = {
    pk: _.castArray(pk).map(key => prefix + key),
    columns: _.keyBy(columns.names, col => prefix + col),
    decomposeTo: single ? 'object' : 'array',
    ...nested.decompose,
  }

  return new JoinColumns<JoinResult<T, O>>(decompose, select)
}
