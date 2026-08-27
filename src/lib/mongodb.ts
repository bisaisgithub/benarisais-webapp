import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _userIndexesPromise: Promise<void> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let userIndexesPromise: Promise<void> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri).connect();
  }

  return clientPromise;
}

/**
 * Enforces email/contact uniqueness on the users collection at the database
 * level, closing the race condition a pre-insert findOne check alone can't.
 * Both fields are optional, so the indexes are partial — a document with no
 * email (or no contact) doesn't collide with any other. Email uniqueness is
 * case-insensitive to match how login and registration look users up.
 * Runs once per server process; a failure (e.g. pre-existing duplicate data)
 * is logged rather than thrown, so registration still works off the
 * application-level check alone.
 */
export function ensureUserIndexes(): Promise<void> {
  if (userIndexesPromise) {
    return userIndexesPromise;
  }

  async function createIndexes() {
    try {
      const client = await getMongoClient();
      const db = process.env.MONGODB_DB
        ? client.db(process.env.MONGODB_DB)
        : client.db();
      const collection = db.collection("users");

      await Promise.all([
        collection.createIndex(
          { email: 1 },
          {
            unique: true,
            collation: { locale: "en", strength: 2 },
            partialFilterExpression: { email: { $type: "string" } },
          },
        ),
        collection.createIndex(
          { contact: 1 },
          {
            unique: true,
            partialFilterExpression: { contact: { $type: "string" } },
          },
        ),
      ]);
    } catch (error) {
      console.error("Failed to ensure user indexes:", error);
    }
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._userIndexesPromise) {
      global._userIndexesPromise = createIndexes();
    }
    userIndexesPromise = global._userIndexesPromise;
  } else {
    userIndexesPromise = createIndexes();
  }

  return userIndexesPromise;
}
