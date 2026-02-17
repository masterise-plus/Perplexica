# Database

The Convex database provides a relational data model, stores JSON-like documents, and can be used with or without a schema. It "just works," giving you predictable query performance in an easy-to-use interface.

Query and mutation [functions](/functions.md) read and write data through a lightweight JavaScript API. There is nothing to set up and no need to write any SQL. Just use JavaScript to express your app's needs.

Start by learning about the basics of [tables](#tables), [documents](#documents) and [schemas](#schemas) below, then move on to [Reading Data](/database/reading-data/.md) and [Writing Data](/database/writing-data.md).

As your app grows more complex you'll need more from your database:

- Relational data modeling with [Document IDs](/database/document-ids.md)
- Fast querying with [Indexes](/database/reading-data/indexes/.md)
- Exposing large datasets with [Paginated Queries](/database/pagination.md)
- Type safety by [Defining a Schema](/database/schemas.md)
- Interoperability with data [Import & Export](/database/import-export/.md)

## Tables[​](#tables 'Direct link to Tables')

Your Convex deployment contains tables that hold your app's data. Initially, your deployment contains no tables or documents.

Each table springs into existence as soon as you add the first document to it.

```
// `friends` table doesn't exist.
await ctx.db.insert("friends", { name: "Jamie" });
// Now it does, and it has one document.
```

You do not have to specify a schema upfront or create tables explicitly.

## Documents[​](#documents 'Direct link to Documents')

Tables contain documents. Documents are very similar to JavaScript objects. They have fields and values, and you can nest arrays or objects within them.

These are all valid Convex documents:

```
{}
{"name": "Jamie"}
{"name": {"first": "Ari", "second": "Cole"}, "age": 60}
```

They can also contain references to other documents in other tables. See [Data Types](/database/types.md) to learn more about the types supported in Convex and [Document IDs](/database/document-ids.md) to learn about how to use those types to model your data.

## Schemas[​](#schemas 'Direct link to Schemas')

Though optional, schemas ensure that your data looks exactly how you want. For a simple chat app, the schema will look like this:

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// @snippet start schema
export default defineSchema({
  messages: defineTable({
    author: v.id("users"),
    body: v.string(),
  }),
});
```

You can choose to be as flexible as you want by using types such as `v.any()` or as specific as you want by precisely describing a `v.object()`.

See [the schema documentation](/database/schemas.md) to learn more about schemas.

## [Next: Reading Data](/database/reading-data/.md)

[Query and read data from Convex database tables](/database/reading-data/.md)

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)

# Writing Data

[Mutations](/functions/mutation-functions.md) can insert, update, and remove data from database tables.

## Inserting new documents[​](#inserting-new-documents 'Direct link to Inserting new documents')

You can create new documents in the database with the [`db.insert`](/api/interfaces/server.GenericDatabaseWriter.md#insert) method:

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", { text: args.text });
    // do something with `taskId`
  },
});
```

The second argument to `db.insert` is a JavaScript object with data for the new document.

The same types of values that can be passed into and returned from [queries](/functions/query-functions.md) and [mutations](/functions/mutation-functions.md) can be written into the database. See [Data Types](/database/types.md) for the full list of supported types.

The `insert` method returns a globally unique ID for the newly inserted document.

## Updating existing documents[​](#updating-existing-documents 'Direct link to Updating existing documents')

Given an existing document ID the document can be updated using the following methods:

1. The [`db.patch`](/api/interfaces/server.GenericDatabaseWriter.md#patch) method will patch an existing document, shallow merging it with the given partial document. New fields are added. Existing fields are overwritten. Fields set to `undefined` are removed.

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const { id } = args;
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", status: { done: true }, _id: ... }

    // Add `tag` and overwrite `status`:
    await ctx.db.patch("tasks", id, { tag: "bar", status: { archived: true } });
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", tag: "bar", status: { archived: true }, _id: ... }

    // Unset `tag` by setting it to `undefined`
    await ctx.db.patch("tasks", id, { tag: undefined });
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", status: { archived: true }, _id: ... }
  },
});
```

2. The [`db.replace`](/api/interfaces/server.GenericDatabaseWriter.md#replace) method will replace the existing document entirely, potentially removing existing fields:

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const replaceTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const { id } = args;
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", _id: ... }

    // Replace the whole document
    await ctx.db.replace("tasks", id, { invalid: true });
    console.log(await ctx.db.get("tasks", id));
    // { invalid: true, _id: ... }
  },
});
```

## Deleting documents[​](#deleting-documents 'Direct link to Deleting documents')

Given an existing document ID the document can be removed from the table with the [`db.delete`](/api/interfaces/server.GenericDatabaseWriter.md#delete) method.

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete("tasks", args.id);
  },
});
```

## Bulk inserts or updates[​](#bulk-inserts-or-updates 'Direct link to Bulk inserts or updates')

If you are used to SQL you might be looking for some sort of bulk insert or bulk update statement. In Convex the entire `mutation` function is automatically a single transaction.

You can just insert or update in a loop in the mutation function. Convex queues up all database changes in the function and executes them all in a single transaction when the function ends, leading to a single efficient change to the database.

````
/**
 * Bulk insert multiple products into the database.
 *
 * Equivalent to the SQL:
 * ```sql
 * INSERT INTO products (product_id, product_name, category, price, in_stock)
 * VALUES
 *     ('Laptop Pro', 'Electronics', 1299.99, true),
 *     ('Wireless Mouse', 'Electronics', 24.95, true),
 *     ('Ergonomic Keyboard', 'Electronics', 89.50, true),
 *     ('Ultra HD Monitor', 'Electronics', 349.99, false),
 *     ('Wireless Headphones', 'Audio', 179.99, true);
 * ```
 */
export const bulkInsertProducts = mutation({
  args: {
    products: v.array(
      v.object({
        product_name: v.string(),
        category: v.string(),
        price: v.number(),
        in_stock: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { products } = args;

    // Insert in a loop. This is efficient because Convex queues all the changes
    // to be executed in a single transaction when the mutation ends.
    for (const product of products) {
      const id = await ctx.db.insert("products", {
        product_name: product.product_name,
        category: product.category,
        price: product.price,
        in_stock: product.in_stock,
      });
    }
  },
});
````

## Migrations[​](#migrations 'Direct link to Migrations')

Database migrations are done through the migration component. The component is designed to run online migrations to safely evolve your database schema over time. It allows you to resume from failures, and validate changes with dry runs.

[Convex Component](https://www.convex.dev/components/migrations)

### [Migrations](https://www.convex.dev/components/migrations)

[Framework for long running data migrations of live data.](https://www.convex.dev/components/migrations)

## Write performance and limits[​](#write-performance-and-limits 'Direct link to Write performance and limits')

To prevent accidental writes of large amounts of records, queries and mutations enforce limits detailed [here](/production/state/limits.md#transactions).
