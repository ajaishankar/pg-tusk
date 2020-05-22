import * as _ from 'lodash'

import { ColumnsBase, TableBase } from './base'
import { Expr } from './expr'

export type QueryConfig = { type?: never; text: string; values: any[] }

export type WhereQueryConfig = { type: 'where'; text: string; values: any[] }

export type FromQueryConfig = { type: 'from'; text: string; values: any[] }

export class SqlSafeString {
  constructor(readonly value: string) {}
  toString() {
    return this.value
  }
}

export class EmbeddedSql {
  constructor(readonly literals: TemplateStringsArray, readonly params: any[]) {}
}

function interpolate(literals: TemplateStringsArray, params: any[], indexes: Map<any, number>, values: any[]) {
  let text = ''

  // interleave the literals with the placeholders
  for (let i = 0; i < params.length; i++) {
    text += literals[i]
    let param = params[i]
    if (
      param instanceof ColumnsBase ||
      param instanceof TableBase ||
      param instanceof SqlSafeString ||
      param instanceof Expr
    ) {
      text += param.toString()
    } else if (param instanceof EmbeddedSql) {
      text += interpolate(param.literals, param.params, indexes, values)
    } else {
      if (!indexes.has(param)) {
        indexes.set(param, indexes.size + 1)
        values.push(param)
      }
      text += '$' + indexes.get(param)
    }
  }
  // add the last literal
  text += literals[literals.length - 1]

  return text
}

export function sql(literals: TemplateStringsArray, ...params: any[]): QueryConfig {
  let indexes = new Map<any, number>()
  let values: any[] = []
  let text = interpolate(literals, params, indexes, values)
  return { text, values }
}

export function where(literals: TemplateStringsArray, ...params: any[]): WhereQueryConfig {
  let { text, values } = sql(literals, ...params)
  text = ' where ' + text
  return { type: 'where', text, values }
}

export function from(literals: TemplateStringsArray, ...params: any[]): FromQueryConfig {
  let { text, values } = sql(literals, ...params)
  text = ' from ' + text
  return { type: 'from', text, values }
}

sql.embed = (literals: TemplateStringsArray, ...params: any[]) => new EmbeddedSql(literals, params)

sql.safe = (value: any) => new SqlSafeString(String(value))

sql.from = from

sql.where = where
