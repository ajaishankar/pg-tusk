# pg-tusk: Typescript for PostgreSQL

Tusk is a tiny data mapper for Postgres that embraces Typescript and SQL.

It is not an ORM, not a query builder, nor does it introspect the database or codegen Typescript classes.

Its only purpose in life is to *strongly type* queries and stay out of the way of your efficient hand crafted SQL.

Think of it as [Dapper](https://github.com/StackExchange/Dapper) for Typescript!

## Usage

### 1. Map a database table to a Typescript type

But rather than just declaring a type, let's define a *table* instead and then infer the type

```typescript
import { ColumnTypes as C, TableSchema, table } from 'pg-tusk'

export const customers = table('customers', {
  id: C.number,
  name: C.string,
  age: C.number,
})

export type Customer = TableSchema<typeof customers>
```

### 2. Insert, update and delete data in a table

```typescript
import * as t from './tables'

let customer = await client.insert(t.customers, { name: 'john doe', age: 41 })
let updated  = await client.update(t.customers, { age: 42 }, where`id = ${customer.id}`)
let deleted  = await client.delete(t.customers,              where`id = ${customer.id}`)
```

### 3. Grab a connection and run queries (maybe inside a transaction)

A Tusk client is a simple wrapper over a `pg.PoolClient` allowing inserts, updates, deletes and typed selects

```typescript
import { Database } from 'pg-tusk'
import * as t from './tables'

const db = new Database({ connectionString }) // pg.PoolConfig

await db.withTask(async client => {
  await client.withTransaction(async () => {
    let customers = await client.select(t.customers, where`age >= 21`)
    await client.query(...) // an arbitrary query
  })
}
```

Select from a table *where*...

```typescript
let customers = await client.select(t.customers, where`age >= 21`)
```

Or select columns *from* a table where...

```typescript
let customers = await client.select(columns, from`customers where age >= 21`)
```

### 4. Tagged template literals (sql, from, where)

Tusk is all about *parameterized* SQL that gets passed to the insanely simple [Postgres Client](https://node-postgres.com/features/queries) as a `pg.QueryConfig`

```typescript
import * as t from './tables'

let age = 21
let columns = t.customers.columns

sql`select ${columns} from customers where age >= ${age}` == {
  text: 'select "id", "name", "age" from customers where age >= $1',
  values: [age]
}
```

Complex parameterized queries can also be built up and *embedded* in the final query

```typescript
let filter  = sql.embed`age >= ${age}` // embedded (parameterized)
let orderBy = sql.safe`order by name`  // sql.safe (not parameterized)

sql`select * from customers where ${filter} ${orderBy}`) == {
  text: 'select * from customers where age >= $1 order by name',
  values: [age],
}
```

### 5. Computed columns

Columns can be *extended* with type safe computed expressions and queried

```typescript
let columns = t.customers.columns.extend({
  adult: Expr.boolean('case when age >= 21 then true else false end'),
})

let customers = await client.select(columns, from`customers where age >= 21`)

typeof customers == {
  id: number
  name: string
  age: number
  adult: boolean
}[]
```

### 6. Joined columns

Tusk borrows the [Standalone Resultset Decomposition](https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition) idea (and code) from the excellent [MassiveJS](https://massivejs.org) library.

Table joins can be defined in a type safe way and internally generates a Massive decompose schema

```typescript
import { join } from 'pg-tusk'

// join customers, orders, order items and products - batteries included!
const customersWithOrders = t.customers.join({
  as: 'c',
  pk: 'id',                                 // specify pk as in MassiveJS
  extend: {                                 // extend customer with a computed column
    adult: Expr.boolean('case when c.age >= 21 then true else false end'),
  },
  orders: t.orders.join({
    as: 'o',
    pk: ['id'],
    on: 'o.customer_id = c.id',
    omit: ['customer_id'],                  // omit customer_id from orders
    items: t.order_items.join({
      as: 'i',
      pk: 'id',
      on: 'i.order_id = o.id',
      omit: ['order_id', 'product_id'],
      product: t.products.leftJoin({        // MassiveJS supports inner and left joins only
        as: 'p',
        pk: 'id',
        on: 'i.product_id = p.id',
        single: true,                       // product is an object, not array
      }),
    }),
  }),
})

type CustomerWithOrders = JoinTableSchema<typeof customersWithOrders>  
```

Select the data as usual and decompose to nested relations

```typescript
let customers = await client.select(customersWithOrders, where`c.id = ${id}`)
```

<img src="https://user-images.githubusercontent.com/328008/83204104-9cc61f80-a110-11ea-9dc6-2223178bfe28.png" width="100%" height="200px">

Thanks to some Typescript magic, the above definition automatically results in the following type!

```typescript
type CustomerWithOrders = {
  id: number
  name: string
  age: number
  adult: boolean
  orders: {
    id: number
    date: Date
    status: t.OrderStatus
    total: number
    items: {
      id: number
      total: number
      price: number
      quantity: number
      product: {
        id: number
        name: string
      }
    }[]
  }[]
}

```

### 7. [Unit Testing](./tests)

Tusk makes it a breeze to unit test your database queries!

Included is a `TestDatabase` that begins a transaction for each test which gets rolled back at the end.

A sample Jest integration is as simple as this

```typescript
export function getTestDatabase() {
  let db = new TestDatabase({ connectionString, max: 1 })

  beforeAll(() => db.beforeAllTests())
  afterAll(() => db.afterAllTests())
  beforeEach(() => db.beforeEachTest())
  afterEach(() => db.afterEachTest())

  return db
}
```

### 8. Running pg-tusk tests

Tusk connects to a Postgres database to run its tests.

Create a local database `pgtusk` and  run

```shell
PGTUSK_DATABASE_URL='postgres://127.0.0.1:5432/pgtusk?sslmode=disable' npm run coverage
```

