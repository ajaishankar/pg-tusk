# pg-tusk: Typescript for PostgreSQL

Tusk is a tiny data mapper for Postgres that embraces Typescript and SQL.

It is not an ORM, not a query builder, nor does it introspect the database or codegen Typescript classes.

Its only purpose in life is to *strongly type* queries and stay out of the way of your efficient hand crafted SQL.

Think of it as [Dapper](https://github.com/StackExchange/Dapper) for Typescript!

```typescript
let customers = await client.select(columns, from`customers where id = ${id}`)

let customersWithOrders = await client.select(
    joinedColumns,
    from`customers c join order o on ... where c.id = ${id}`
)
```

<img src="https://user-images.githubusercontent.com/328008/82714379-eb2c7780-9c53-11ea-8a42-e5de84491ba2.png" height="200px" width="100%">

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

### 2. Defining a table is worth it

```typescript
import * as t from './tables'

let customer = await t.customers.insert(client, { name: 'john doe', age: 41 })
let updated  = await t.customers.update(client, { age: 42 }, where`id = ${customer.id}`)
let deleted  = await t.customers.delete(client, where`id = ${customer.id}`)
```

### 3. Grab a connection and run queries (maybe inside a transaction)

```typescript
import { Database } from 'pg-tusk'
import * as t from './tables'

const db = new Database({ connectionString }) // pg.PoolOptions

await db.withTask(async client => {
  await client.withTransaction(async () => {
    let customers = await t.customers.find(client, where`age >= 21`)
    await client.query(...)
  })
}
```

### 4. Tagged template literals (sql, from, where)

Tusk is all about *parameterized* SQL that gets passed to the insanely simple [Postgres Client](https://node-postgres.com/features/queries) as a QueryConfig

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
let filter = sql.embed`age >= ${age}`
let order = sql.safe'name'

sql`select * from customers where ${filter} order by ${order}`) == {
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

let customers = await client.select(columns, from`customers`)

typeof customers == {
  id: number
  name: string
  age: number
  adult: boolean
}[]
```

### 6. Joined columns

Tusk borrows the [Standalone Resultset Decomposition](https://massivejs.org/docs/joins-and-result-trees#standalone-resultset-decomposition) idea (and code) from the excellent [MassiveJS](https://massivejs.or) library.

Column joins can be defined in a type safe way and internally generates a Massive decompose schema

```typescript
import { join } from 'pg-tusk'

// declare column joins at module level
const customersWithOrders = join(t.customers.columns, {
  as: 'c',
  pk: 'id',
  orders: join(t.orders.columns.omit('customer_id'), {
    as: 'o',
    pk: ['id'],
    items: join(t.order_items.columns.omit('order_id', 'product_id'), {
      as: 'i',
      pk: 'id',
      product: join(t.products.columns, {
        as: 'p',
        pk: 'id',
        single: true, // product is an object, not array
      }),
    }),
  }),
})

type CustomerWithOrders = JoinColumnsSchema<typeof customersWithOrders>  
```

Because of some Typescript magic, the above definition results in the following type

```typescript
let customers = await client.select(
    customersWithOrders,
    from`customers c join order o on ... where c.id = ${id}`
)

type CustomerWithOrders = {
    id: number;
    name: string;
    age: number;
    orders: {
        id: number;
        date: Date;
        status: t.OrderStatus;
        total: number;
        items: {
            id: number;
            total: number;
            price: number;
            quantity: number;
            product: {
                id: number;
                name: string;
            };
        }[];
    }[];
}
```

### 7. Unit Testing

Tusk makes it a breeze to unit test your database queries!

Included is a `TestDatabase` that begins a transaction for each test which gets rolled back at the end.

A sample Jest integration is as simple as this, please refer to the examples in the `tests` folder.

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

