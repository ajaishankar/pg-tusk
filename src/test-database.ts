import * as pg from 'pg'
import { Database } from './database'
import { Client } from './client'

/**
 * Test client that ignores transactions.
 *
 * A transaction is started and rolled back by TestDatabase for each test
 */
class TestClient extends Client {
  beginTransaction = (invokeActual = false) => (invokeActual ? super.beginTransaction() : (undefined as any))
  commitTransaction = () => undefined as any // test client never commits transaction
  rollbackTransaction = (invokeActual = false) => (invokeActual ? super.rollbackTransaction() : (undefined as any))
  release = (invokeActual = false) => (invokeActual ? super.release() : undefined)
}

export class TestDatabase extends Database {
  private client?: TestClient

  /**
   * Returns the same instance of the client for all tests
   */
  async getClient() {
    if (this.client == null) {
      this.client = await super.getClient()
    }
    return this.client
  }

  /**
   * Initialize client to be used in tests
   */
  beforeAllTests() {
    return this.getClient()
  }

  /**
   * Release test client and end pool
   */
  afterAllTests() {
    this.client != null && this.client.release(true)
    return this.endPool()
  }

  /**
   * Begins a transaction before each test
   */
  beforeEachTest() {
    return this.client != null && this.client.beginTransaction(true)
  }

  /**
   * Rollback transaction after each test
   */
  afterEachTest() {
    return this.client != null && this.client.rollbackTransaction(true)
  }

  protected createClient(poolClient: pg.PoolClient): Client {
    return new TestClient(poolClient)
  }
}
