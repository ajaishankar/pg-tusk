import * as _ from 'lodash'
import { Client } from './client'
import { Columns } from './columns'
import { WhereQueryConfig } from './sql'
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

  async insert(client: Client, data: Partial<T>): Promise<T>
  async insert(client: Client, data: Partial<T>[]): Promise<T[]>
  async insert(client: Client, data: Partial<T> | Partial<T>[]) {
    let records = _.castArray(data)
    let inserted = [] as T[]

    // todo: optimize batch insert similar to pgp
    for (let item of records) {
      let queryConfig = this.getInsertQuery(item)
      let result = await client.query<T>(queryConfig)
      inserted.push(result.rows[0])
    }

    if (data instanceof Array) {
      return inserted
    } else {
      return inserted[0]
    }
  }

  async find(client: Client, where: WhereQueryConfig) {
    let text = `select ${this.columns} from ${this.name} ${where.text}`
    let result = await client.query<T>({ text, values: where.values })
    return result.rows
  }

  async findOne(client: Client, where: WhereQueryConfig) {
    let result = await this.find(client, where)
    return result.length ? result[0] : undefined
  }

  async select<C extends keyof T>(client: Client, columns: C[], where: WhereQueryConfig) {
    type Row = Pick<T, C>
    let text = `select ${columns.join(', ')} from ${this.name} ${where.text}`
    let result = await client.query<Row>({ text, values: where.values })
    return result.rows
  }

  async update(client: Client, changes: Partial<T>, where: WhereQueryConfig) {
    let queryConfig = this.getUpdateQuery(changes, where)
    let updated = await client.query<T>(queryConfig)
    return updated.rows
  }

  async delete(client: Client, where: WhereQueryConfig) {
    let text = `delete from ${this.name} ${where.text} returning ${this.columns}`
    let result = await client.query<T>({ text, values: where.values })
    return result.rows
  }

  toString() {
    return this.name
  }

  private getInsertQuery(data: Partial<T>) {
    let { columns, values, params } = this.getQueryParams(data)
    let text = `insert into ${this.name} (${columns.join(', ')}) values (${params.join(', ')}) returning ${
      this.columns
    }`
    return { text, values }
  }

  private getUpdateQuery(data: Partial<T>, where: WhereQueryConfig) {
    let { columns, values, params, whereClause } = this.getQueryParams(data, where)
    let setColumns = []
    for (let i = 0; i < columns.length; ++i) {
      setColumns.push(`${columns[i]} = ${params[i]}`)
    }
    let text = `update ${this.name} set ${setColumns} ${whereClause} returning ${this.columns}`

    return { text, values }
  }

  private getQueryParams(data: Partial<T>, where?: WhereQueryConfig) {
    // exclude keys we don't care about
    data = _.pick(data, this.columns.names)
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

export function table<T extends object>(name: string, type: T) {
  let [tableName, schema] = _.trim(name).split('.').reverse()
  return new Table(schema, tableName, type)
}
