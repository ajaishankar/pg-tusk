import { Pool, PoolClient } from 'pg'
import { Database } from '../src'

const connectionString = process.env.PGTUSK_DATABASE_URL as string

describe('database tests', () => {
  it('should create pool from config', async () => {
    let db = new Database({ connectionString, max: 1 })
    try {
      expect(db.pool).toBeDefined()
    } finally {
      await db.endPool()
    }
  })

  it('should reuse pool passed to constructor', async () => {
    let pool = new Pool({ connectionString, max: 1 })
    try {
      let db = new Database(pool)
      expect(Object.is(db.pool, pool)).toBe(true)
    } finally {
      await pool.end()
    }
  })

  describe('withTask()', () => {
    let db = new Database({ connectionString, max: 1 })

    afterAll(() => db.endPool())

    it('should release client', async () => {
      expect.assertions(3)
      await db.withTask(async () => {
        expect(db.pool.totalCount).toBe(1)
        expect(db.pool.idleCount).toBe(0)
      })
      expect(db.pool.idleCount).toBe(1)
    })

    it('should also release client on exception', async () => {
      expect.assertions(3)
      try {
        await db.withTask(async () => {
          expect(db.pool.totalCount).toBe(1)
          expect(db.pool.idleCount).toBe(0)
          throw new Error()
        })
        // eslint-disable-next-line no-empty
      } catch (e) {}
      expect(db.pool.idleCount).toBe(1)
    })
  })

  describe('withTransaction()', () => {
    /**
     * Tracks calls to transaction begin, commit and rollback
     */
    class TrackingDatabase extends Database {
      transaction = { started: false, committed: false, rolledBack: false }

      createClient(poolClient: PoolClient) {
        let client = super.createClient(poolClient)

        let begin = client.beginTransaction.bind(client)
        let commit = client.commitTransaction.bind(client)
        let rollback = client.rollbackTransaction.bind(client)

        client.beginTransaction = () => (this.transaction.started = true) && begin()
        client.commitTransaction = () => (this.transaction.committed = true) && commit()
        client.rollbackTransaction = () => (this.transaction.rolledBack = true) && rollback()

        return client
      }
    }

    let db: TrackingDatabase

    beforeEach(() => (db = new TrackingDatabase({ connectionString, max: 1 })))
    afterEach(() => db.endPool())

    it('should begin transaction', async () => {
      await db.withTask(async client => {
        await client.withTransaction(async () => {
          expect(db.transaction.started).toBe(true)
        })
      })
    })

    it('should commit transaction', async () => {
      await db.withTask(async client => {
        await client.withTransaction(async () => {
          expect(db.transaction.started).toBe(true)
        })
      })
      expect(db.transaction.committed).toBe(true)
    })

    it('should rollback transaction on error', async () => {
      try {
        await db.withTask(async client => {
          await client.withTransaction(async () => {
            expect(db.transaction.started).toBe(true)
            throw new Error()
          })
        })
        // eslint-disable-next-line no-empty
      } catch (e) {}
      expect(db.transaction.rolledBack).toBe(true)
      expect(db.transaction.committed).toBe(false)
    })
  })
})
