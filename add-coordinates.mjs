import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dryRun = process.argv.includes("--dry");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Looks up a place name with OpenStreetMap Nominatim (Bangladesh only)
async function geocode(location) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=" +
    encodeURIComponent(location);

  const res = await fetch(url, {
    headers: { "User-Agent": "oikyo-seed-script" },
  });
  if (!res.ok) return null;

  const [first] = await res.json();
  if (!first) return null;

  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db("eventsPlatform");
  const events = db.collection("events");
  const joinedEvents = db.collection("joinedEvents");

  const total = await events.countDocuments();
  console.log("Database:", db.databaseName, "| total events:", total);

  // Events with no pin: field missing or null
  const missing = await events
    .find({ $or: [{ coordinates: { $exists: false } }, { coordinates: null }] })
    .toArray();
  console.log(`${missing.length} events without coordinates`);

  for (const event of missing) {
    const coordinates = await geocode(event.location);

    if (!coordinates) {
      console.log(`NOT FOUND: ${event.title} (${event.location})`);
    } else {
      console.log(
        `${event.title} -> ${coordinates.latitude}, ${coordinates.longitude}`,
      );
      if (!dryRun) {
        await events.updateOne({ _id: event._id }, { $set: { coordinates } });
        // Joined events keep a copy of the event details, so update those too
        await joinedEvents.updateMany(
          { eventId: event._id },
          { $set: { coordinates } },
        );
      }
    }

    await sleep(1100); // Nominatim allows 1 request per second
  }
} finally {
  await client.close();
}
