import * as _ from 'lodash'
import * as pg from 'pg'

import { QueryConfig, FromQueryConfig, WhereQueryConfig } from './sql'
import { Columns } from './columns'
import { JoinTable } from './join'

import { ElementType, TableBase } from './base'
import { Table } from './table'

export class Client {
  constructor(protected client: pg.PoolClient) {}

  query<R extends pg.QueryResultRow = any>(queryConfig: QueryConfig) {
    return this.client.query<R>(queryConfig)
  }

  async select<T extends object>(columns: Columns<T>, from: FromQueryConfig): Promise<T[]>
  async select<T extends object>(joinTable: JoinTable<T>, where: WhereQueryConfig): Promise<ElementType<T>[]>
  async select<T extends object>(table: Table<T>, where: WhereQueryConfig): Promise<T[]>
  async select<T extends object>(table: Table<T>, subset: (keyof T)[], where: WhereQueryConfig): Promise<T[]>
  async select<T extends object>(
    source: Columns<T> | JoinTable<T> | Table<T>,
    subsetOrQuery: FromQueryConfig | WhereQueryConfig | (keyof T)[],
    query?: FromQueryConfig | WhereQueryConfig,
  ) {
    type Row = ElementType<T>

    let columns =
      subsetOrQuery instanceof Array
        ? subsetOrQuery.map(col => `"${col}"`).join(', ')
        : source instanceof JoinTable
        ? source.columns
        : source instanceof Table
        ? source.columns
        : source // columns

    let { text, values } = query != null ? query : ((subsetOrQuery as unknown) as QueryConfig)

    text = source instanceof TableBase ? `select ${columns} from ${source} ${text}` : `select ${columns} ${text}`

    let result = await this.query<Row>({ text, values })
    if (source instanceof JoinTable) {
      result.rows = source.decompose(result.rows)
    }
    return result.rows
  }

  async first<T extends object>(table: Table<T>, where: WhereQueryConfig) {
    return _.first(await this.select(table, where))
  }

  async insert<T extends object>(table: Table<T>, data: Partial<T>): Promise<T>
  async insert<T extends object>(table: Table<T>, data: Partial<T>[]): Promise<T[]>
  async insert<T extends object>(table: Table<T>, data: Partial<T> | Partial<T>[]) {
    let records = _.castArray(data)
    let inserted = [] as T[]

    // todo: optimize batch insert similar to pgp
    for (let item of records) {
      let queryConfig = this.getInsertQuery(table, item)
      let result = await this.query<T>(queryConfig)
      inserted.push(result.rows[0])
    }

    if (data instanceof Array) {
      return inserted
    } else {
      return inserted[0]
    }
  }

  async update<T extends object>(table: Table<T>, changes: Partial<T>, where: WhereQueryConfig) {
    let queryConfig = this.getUpdateQuery(table, changes, where)
    let updated = await this.query<T>(queryConfig)
    return updated.rows
  }

  async delete<T extends object>(table: Table<T>, where: WhereQueryConfig) {
    let text = `delete from ${table} ${where.text} returning ${table.columns}`
    let result = await this.query<T>({ text, values: where.values })
    return result.rows
  }

  release() {
    this.client.release()
  }

  beginTransaction() {
    return this.client.query('BEGIN')
  }

  commitTransaction() {
    return this.client.query('COMMIT')
  }

  rollbackTransaction() {
    return this.client.query('ROLLBACK')
  }

  async withTransaction<T = any>(action: () => Promise<T>) {
    try {
      await this.beginTransaction()
      let result = await action()
      await this.commitTransaction()
      return result
    } catch (e) {
      await this.rollbackTransaction()
      throw e
    }
  }

  private getInsertQuery<T extends object>(table: Table<T>, data: Partial<T>) {
    let { columns, values, params } = this.getQueryParams(table, data)
    let text = `insert into ${table} (${columns.join(', ')}) values (${params.join(', ')}) returning ${table.columns}`
    return { text, values }
  }

  private getUpdateQuery<T extends object>(table: Table<T>, data: Partial<T>, where?: WhereQueryConfig) {
    let { columns, values, params, whereClause } = this.getQueryParams(table, data, where)
    let setColumns = []
    for (let i = 0; i < columns.length; ++i) {
      setColumns.push(`${columns[i]} = ${params[i]}`)
    }
    let text = `update ${table} set ${setColumns} ${whereClause} returning ${table.columns}`

    return { text, values }
  }

  private getQueryParams<T extends object>(table: Table<T>, data: Partial<T>, where?: WhereQueryConfig) {
    // exclude keys we don't care about
    data = _.pick(data, table.columns.names)
    data = _.pickBy(data, value => value !== undefined) as Partial<T>

    let columns = [] as string[]
    let values = []
    let params = [] as string[]

    let whereValues = where != null && where.values != null ? where.values : []
    let whereClause = where != null ? where.text : ''

    let paramIndex = whereValues.length

    _.forIn(data, (value, col) => {
      paramIndex += 1
      columns.push(`"${col}"`)
      values.push(value)
      params.push(`$${paramIndex}`)
    })

    values.unshift(...whereValues)

    return { columns, values, params, whereClause }
  }
}
