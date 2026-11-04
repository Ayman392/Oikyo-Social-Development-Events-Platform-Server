import "dotenv/config";
import fs from "fs";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const db = client.db("eventsPlatform");
const events = db.collection("events");
const joinedEvents = db.collection("joinedEvents");

// ---------- Remove mode: node import-events.js --remove ----------
if (process.argv[2] === "--remove") {
  const sample = await events.find({ seeded: true }).project({ _id: 1 }).toArray();
  const ids = sample.map((event) => event._id);

  await joinedEvents.deleteMany({ eventId: { $in: ids } });
  const result = await events.deleteMany({ seeded: true });

  console.log(`Removed ${result.deletedCount} sample events.`);
  await client.close();
  process.exit(0);
}

// ---------- Import mode: node import-events.js ----------

// Read the file. Values written as { "$date": "..." } become real dates.
const text = fs.readFileSync("./events.json", "utf-8");
const list = JSON.parse(text, (key, value) =>
  value && value.$date ? new Date(value.$date) : value
);

let added = 0;
let updated = 0;

for (const event of list) {
  // These two are only set the first time, so re-running never resets the volunteer count
  const { volunteersCount, createdAt, ...rest } = event;

  const result = await events.updateOne(
    { title: event.title, seeded: true },
    { $set: rest, $setOnInsert: { volunteersCount, createdAt } },
    { upsert: true }
  );

  if (result.upsertedCount > 0) added++;
  else updated++;
}

console.log(`Added ${added} new events, refreshed ${updated} existing ones.`);
await client.close();
