import { types } from 'pg'
import { TestDatabase } from '../src'

types.setTypeParser(types.builtins.NUMERIC, 'text', parseFloat)

const connectionString = process.env.PGTUSK_DATABASE_URL as string

export function getTestDatabase() {
  let db = new TestDatabase({ connectionString, max: 1 })

  beforeAll(() => db.beforeAllTests())
  afterAll(() => db.afterAllTests())
  beforeEach(() => db.beforeEachTest())
  afterEach(() => db.afterEachTest())

  return db
}
