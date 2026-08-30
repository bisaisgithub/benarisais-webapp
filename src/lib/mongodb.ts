import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _userIndexesPromise: Promise<void> | undefined;
  var _siteIndexesPromise: Promise<void> | undefined;
  var _courtIndexesPromise: Promise<void> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let userIndexesPromise: Promise<void> | undefined;
let siteIndexesPromise: Promise<void> | undefined;
let courtIndexesPromise: Promise<void> | undefined;

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

/**
 * Enforces site-name uniqueness at the database level, closing the race a
 * pre-insert findOne check alone can't. Matching is case-insensitive so
 * "Main Court" and "main court" collide, which is how the pre-check reads
 * them too. Runs once per server process; a failure (e.g. pre-existing
 * duplicate data) is logged rather than thrown, so adding a site still
 * works off the application-level check alone.
 */
export function ensureSiteIndexes(): Promise<void> {
  if (siteIndexesPromise) {
    return siteIndexesPromise;
  }

  async function createIndexes() {
    try {
      const client = await getMongoClient();
      const db = process.env.MONGODB_DB
        ? client.db(process.env.MONGODB_DB)
        : client.db();

      await db
        .collection("sites")
        .createIndex(
          { name: 1 },
          { unique: true, collation: { locale: "en", strength: 2 } },
        );
    } catch (error) {
      console.error("Failed to ensure site indexes:", error);
    }
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._siteIndexesPromise) {
      global._siteIndexesPromise = createIndexes();
    }
    siteIndexesPromise = global._siteIndexesPromise;
  } else {
    siteIndexesPromise = createIndexes();
  }

  return siteIndexesPromise;
}

/**
 * Enforces one court number per site: the compound key is unique, so the
 * same number can exist at different sites but never twice at one. This is
 * what makes concurrent adds safe — both requests read the same last number,
 * and the second insert fails on the index rather than duplicating a court.
 * Runs once per server process; a failure (e.g. pre-existing duplicate data)
 * is logged rather than thrown.
 */
export function ensureCourtIndexes(): Promise<void> {
  if (courtIndexesPromise) {
    return courtIndexesPromise;
  }

  async function createIndexes() {
    try {
      const client = await getMongoClient();
      const db = process.env.MONGODB_DB
        ? client.db(process.env.MONGODB_DB)
        : client.db();

      await db
        .collection("courts")
        .createIndex({ siteId: 1, number: 1 }, { unique: true });
    } catch (error) {
      console.error("Failed to ensure court indexes:", error);
    }
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._courtIndexesPromise) {
      global._courtIndexesPromise = createIndexes();
    }
    courtIndexesPromise = global._courtIndexesPromise;
  } else {
    courtIndexesPromise = createIndexes();
  }

  return courtIndexesPromise;
}
