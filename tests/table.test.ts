import * as t from './tables'
import { getTestDatabase } from './db'
import { Client, where, table, ColumnTypes as C } from '../src'

const db = getTestDatabase()

describe('table tests', () => {
  let client: Client

  beforeEach(async () => (client = await db.getClient()))

  function findProduct(id: number) {
    return t.products.findOne(client, where`id = ${id}`)
  }

  it('should recognize table schema', () => {
    let tbl = table('catalog.products', { id: C.number, name: C.string })
    expect(tbl.toString()).toBe(`"catalog"."products"`)
  })

  it('can insert record', async () => {
    let product = await t.products.insert(client, { name: 'product 1' })

    expect(await findProduct(product.id)).toEqual(product)
  })

  it('can insert multiple records', async () => {
    let products = await t.products.insert(client, [{ name: 'product 1' }, { name: 'product 2' }])

    expect(products).toEqual([
      { id: expect.any(Number), name: 'product 1' },
      { id: expect.any(Number), name: 'product 2' },
    ])
  })

  it('insert should ignore unknown fields', async () => {
    let product = await t.products.insert(client, { name: 'product 1', foo: 'bar' } as any)

    expect(product).toEqual({ id: expect.any(Number), name: 'product 1' })
  })

  it('can update records', async () => {
    let [product, other] = await t.products.insert(client, [{ name: 'product 1' }, { name: 'other' }])

    let updated = await t.products.update(client, { name: 'product 2' }, where`id = ${product.id}`)

    expect(updated).toEqual([{ id: product.id, name: 'product 2' }])

    expect(await findProduct(product.id)).toEqual(updated[0])
    expect(await findProduct(other.id)).toEqual(other)
  })

  it('update should ignore unknown fields', async () => {
    let product = await t.products.insert(client, { name: 'product 1' })

    let updated = await t.products.update(client, { name: 'product 2', foo: 'bar' } as any, where`id = ${product.id}`)

    expect(updated).toEqual([{ id: product.id, name: 'product 2' }])
  })

  it('can delete records', async () => {
    let [product, other] = await t.products.insert(client, [{ name: 'product 1' }, { name: 'other' }])

    expect(await findProduct(product.id)).toEqual(product)

    let deleted = await t.products.delete(client, where`id = ${product.id}`)

    expect(deleted).toEqual([product])

    expect(await findProduct(product.id)).toBeUndefined()
    expect(await findProduct(other.id)).toEqual(other)
  })

  it('can find records', async () => {
    let products = await t.products.insert(client, [{ name: 'product 1' }, { name: 'product 2' }])

    let ids = [products[0].id, 0, -1]

    let found = await t.products.find(client, where`id = any(${ids}::integer[]) order by id`)

    expect(found).toEqual([products[0]])
  })

  it('can select subset of columns', async () => {
    await t.products.insert(client, [{ name: 'product 1' }, { name: 'product 2' }])
    let namesOnly = await t.products.select(client, ['name'], where`true order by name`)
    expect(namesOnly).toEqual([{ name: 'product 1' }, { name: 'product 2' }])
  })
})
