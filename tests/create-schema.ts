import { Database, sql } from '../src'

const CREATE_SCHEMA_SQL = sql`
  DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        create type order_status as enum ('ordered', 'shipped', 'delivered');
      END IF;
    END
  $$;

  create table if not exists products (
    id serial primary key,
    name text not null
  );

  create table if not exists customers (
    id serial primary key,
    name text not null,
    age integer not null
  );

  create table if not exists orders (
    id serial primary key,
    customer_id integer not null references customers(id),
    date timestamptz not null,
    status order_status not null default('ordered'),
    total numeric(6, 2) not null
  );

  create table if not exists order_items (
    id serial primary key, 
    order_id integer not null references orders(id),
    product_id integer not null references products(id),
    price numeric(6, 2) not null,
    quantity integer not null,
    total numeric(6, 2) not null
  );
`

const connectionString = process.env.PGTUSK_DATABASE_URL as string

export default async function createSchema() {
  if (!connectionString) {
    throw new Error('Please set PGTUSK_DATABASE_URL env variable before running tests')
  }

  let db = new Database({ connectionString, max: 1 })

  await db.withTask(client => {
    return client.withTransaction(() => client.query(CREATE_SCHEMA_SQL))
  })

  await db.endPool()
}
