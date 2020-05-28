import * as _ from 'lodash'
import { Columns } from './columns'
import { TableBase } from './base'
import { Join, Joinable, JoinTable } from './join'

export type TableSchema<U> = U extends Table<infer T> ? T : never

export class Table<T extends object> extends TableBase {
  readonly columns: Columns<T>
  private name: string

  constructor(schema: string, name: string, template: T) {
    super()
    this.columns = new Columns(template)
    this.name = schema ? `"${schema}"."${name}"` : `"${name}"`
  }

  join<X extends object, O extends Join<T, X>>(other: Joinable<O>) {
    return JoinTable.create('inner', { name: this.name, columns: this.columns }, other)
  }

  leftJoin<X extends object, O extends Join<T, X>>(other: Joinable<O>) {
    return JoinTable.create('left outer', { name: this.name, columns: this.columns }, other)
  }

  toString() {
    return this.name
  }
}

export function table<T extends object>(name: string, type: T) {
  let [tableName, schema] = _.trim(name).split('.').reverse()
  return new Table(schema, tableName, type)
}
