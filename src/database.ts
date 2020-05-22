import * as pg from 'pg'
import { Client } from './client'

export class Database {
  readonly pool: pg.Pool

  constructor(options?: pg.Pool | pg.PoolConfig) {
    this.pool = options instanceof pg.Pool ? options : new pg.Pool(options)
  }

  async getClient() {
    return this.createClient(await this.pool.connect())
  }

  async withTask<T = any>(action: (client: Client) => Promise<T>) {
    let client = await this.getClient()
    try {
      return await action(client)
    } finally {
      client.release()
    }
  }

  endPool() {
    return this.pool.end()
  }

  protected createClient(poolClient: pg.PoolClient) {
    return new Client(poolClient)
  }
}
