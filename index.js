import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  await client.connect();
  const db = client.db("eventsPlatform");
  const events = db.collection("events");
  const joinedEvents = db.collection("joinedEvents");

  // Prevent a user joining the same event twice
  await joinedEvents.createIndex({ eventId: 1, userEmail: 1 }, { unique: true });

  console.log("Connected to MongoDB");
}
run().catch(console.error);

app.get("/", (req, res) => res.json({ message: "Events Platform API is running" }));

app.listen(port, () => console.log(`Server listening on port ${port}`));