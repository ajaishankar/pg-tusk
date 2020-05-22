import * as pg from 'pg'

import { QueryConfig, FromQueryConfig } from './sql'
import { Columns } from './columns'
import { JoinColumns } from './join'

import * as decompose from './massive/util/decompose'
import { ElementType } from './base'

export class Client {
  constructor(protected client: pg.PoolClient) {}

  query<R extends pg.QueryResultRow = any>(queryConfig: QueryConfig) {
    return this.client.query<R>(queryConfig)
  }

  async select<T extends object>(columns: Columns<T> | JoinColumns<T>, queryConfig: FromQueryConfig | QueryConfig) {
    let { type, text, values } = queryConfig

    if (type === 'from') {
      text = `select ${columns} ${text}`
    }

    type Row = ElementType<T>

    let result = await this.query<Row>({ text, values })

    if (columns instanceof JoinColumns) {
      result.rows = decompose(columns.decomposeSchema as any, result.rows)
    }

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
}
