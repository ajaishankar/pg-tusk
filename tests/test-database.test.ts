import { getTestDatabase } from './db'

let db = getTestDatabase()

describe('test database', () => {
  it('should manage transactions outside of code under test', async () => {
    await db.withTask(async client => {
      expect(await client.beginTransaction()).toBeUndefined()
      expect(await client.commitTransaction()).toBeUndefined()
      expect(await client.rollbackTransaction()).toBeUndefined()
      expect(client.release()).toBeUndefined()
    })
  })
})
