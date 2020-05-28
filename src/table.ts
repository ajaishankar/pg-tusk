import * as _ from 'lodash'
import { Columns } from './columns'
import { TableBase } from './base'

export type TableSchema<U> = U extends Table<infer T> ? T : never

export class Table<T extends object> extends TableBase {
  readonly columns: Columns<T>
  private name: string

  constructor(schema: string, name: string, template: T) {
    super()
    this.columns = new Columns(template)
    this.name = schema ? `"${schema}"."${name}"` : `"${name}"`
  }

  toString() {
    return this.name
  }
}

export function table<T extends object>(name: string, type: T) {
  let [tableName, schema] = _.trim(name).split('.').reverse()
  return new Table(schema, tableName, type)
}
