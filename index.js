import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: [process.env.CLIENT_URL, "http://localhost:3000"] }));
app.use(express.json());

// ---------- Database ----------

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
console.log("Connected to MongoDB");

const db = client.db("eventsPlatform");
const events = db.collection("events");
const joinedEvents = db.collection("joinedEvents");

// A user can only join a given event once
await joinedEvents.createIndex({ eventId: 1, userEmail: 1 }, { unique: true });

// ---------- Helpers ----------

const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Education",
  "Health Camp",
  "Food Distribution",
  "Other",
];

function isValidUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Checks the event data and returns an object of error messages (empty = all good)
function validateEvent(data) {
  const errors = {};

  if (!data.title || data.title.trim().length < 3 || data.title.trim().length > 100) {
    errors.title = "Title must be between 3 and 100 characters.";
  }

  if (!data.description || data.description.trim().length < 20 || data.description.trim().length > 1000) {
    errors.description = "Description must be between 20 and 1000 characters.";
  }

  if (!EVENT_TYPES.includes(data.eventType)) {
    errors.eventType = "Please choose a valid event type.";
  }

  if (!data.thumbnail || !isValidUrl(data.thumbnail)) {
    errors.thumbnail = "Please enter a valid image URL.";
  }

  if (!data.location || data.location.trim().length < 3 || data.location.trim().length > 120) {
    errors.location = "Location must be between 3 and 120 characters.";
  }

  // The date must be tomorrow or later
  const date = new Date(data.eventDate);
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (!data.eventDate || isNaN(date.getTime())) {
    errors.eventDate = "Please choose an event date.";
  } else if (date < tomorrow) {
    errors.eventDate = "The event date must be in the future.";
  }

  // Guidelines are optional, but if given, each line must be a sensible length
  if (data.guidelines !== undefined) {
    const lines = Array.isArray(data.guidelines) ? data.guidelines : [];
    if (lines.length > 6 || lines.some((line) => line.trim().length < 3 || line.trim().length > 150)) {
      errors.guidelines = "Add up to 6 guidelines, each 3 to 150 characters.";
    }
  }

  return errors;
}

// ---------- Login check (JWT) ----------

// The address of the client site, where the login system publishes its public keys
const AUTH_URL = process.env.AUTH_URL;
const keys = AUTH_URL ? createRemoteJWKSet(new URL(`${AUTH_URL}/api/auth/jwks`)) : null;

// Put this in front of any route that needs a logged-in user.
// It reads the token, checks it, and saves who the user is in req.user.
async function verifyToken(req, res, next) {
  if (!keys) {
    return res.status(500).json({ message: "The server is not set up to check logins yet." });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }

  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
    });

    if (!payload.email) {
      return res.status(401).json({ message: "Your login could not be verified." });
    }

    req.user = { email: payload.email, name: payload.name, image: payload.image };
    next();
  } catch (error) {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}

// ---------- Routes ----------
// Note: /events/upcoming and /events/mine must stay ABOVE /events/:id

app.get("/", (req, res) => {
  res.json({ message: "Oikyo API is running" });
});

// Test route: shows who the server thinks you are
app.get("/me", verifyToken, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name });
});

// Upcoming events, soonest first. Use ?limit=6 to get only a few.
app.get("/events/upcoming", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0; // 0 means no limit

    // Events happening today still count as upcoming
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const upcoming = await events
      .find({ eventDate: { $gte: startOfToday } })
      .sort({ eventDate: 1 })
      .limit(limit)
      .toArray();

    res.json(upcoming);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load events." });
  }
});

// Events created by one user (for the Manage Events page)
app.get("/events/mine", verifyToken, async (req, res) => {
  try {
    // The email now comes from the verified token, not from the address
    const mine = await events
      .find({ creatorEmail: req.user.email })
      .sort({ eventDate: 1 })
      .toArray();

    res.json(mine);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your events." });
  }
});

// One event by id (public, no login needed)
app.get("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "That event link is not valid." });
    }

    const event = await events.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load the event." });
  }
});

// Create an event
app.post("/events", verifyToken, async (req, res) => {
  try {
    const data = req.body;

    const errors = validateEvent(data);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please fix the errors and try again.", errors });
    }

    const newEvent = {
      title: data.title.trim(),
      description: data.description.trim(),
      eventType: data.eventType,
      thumbnail: data.thumbnail.trim(),
      location: data.location.trim(),
      eventDate: new Date(data.eventDate),
      guidelines: (data.guidelines || []).map((line) => line.trim()).filter(Boolean),
      creatorEmail: req.user.email,
      creatorName: req.user.name || "",
      creatorPhoto: req.user.image || "",
      volunteersCount: 0,
      createdAt: new Date(),
    };

    const result = await events.insertOne(newEvent);

    res.status(201).json({ message: "Event created successfully.", eventId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create the event." });
  }
});

// Update an event (owner only)
app.patch("/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userEmail = req.user.email; 

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "That event link is not valid." });
    }

    if (!userEmail) {
      return res.status(401).json({ message: "Please log in to update an event." });
    }

    const event = await events.findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    // Only the person who created the event can change it
    if (event.creatorEmail !== userEmail) {
      return res.status(403).json({ message: "You can only update events you created." });
    }

    const errors = validateEvent(data);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please fix the errors and try again.", errors });
    }

    const changes = {
      title: data.title.trim(),
      description: data.description.trim(),
      eventType: data.eventType,
      thumbnail: data.thumbnail.trim(),
      location: data.location.trim(),
      eventDate: new Date(data.eventDate),
      guidelines: (data.guidelines || []).map((line) => line.trim()).filter(Boolean),
      updatedAt: new Date(),
    };

    await events.updateOne({ _id: event._id }, { $set: changes });

    // Joined events keep a copy of the event details, so keep those copies up to date too
    await joinedEvents.updateMany(
      { eventId: event._id },
      {
        $set: {
          title: changes.title,
          thumbnail: changes.thumbnail,
          location: changes.location,
          eventType: changes.eventType,
          eventDate: changes.eventDate,
        },
      }
    );

    res.json({ message: "Event updated successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update the event." });
  }
});

// Delete an event (owner only)
app.delete("/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const email  = req.user.email;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "That event link is not valid." });
    }

    const event = await events.findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    if (event.creatorEmail !== email) {
      return res.status(403).json({ message: "You can only delete events you created." });
    }

    // Remove the volunteers' joins first, then the event itself
    await joinedEvents.deleteMany({ eventId: event._id });
    await events.deleteOne({ _id: event._id });

    res.json({ message: "Event deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete the event." });
  }
});

// ---------- Join an event ----------

app.post("/events/:id/join",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email; 
    const userName = req.user.name || "";

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "That event link is not valid." });
    }

    if (!userEmail) {
      return res.status(400).json({ message: "Please log in to join an event." });
    }

    const event = await events.findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    // Past events can't be joined
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    if (event.eventDate < startOfToday) {
      return res.status(400).json({ message: "This event has already taken place." });
    }

    // Save the join together with the event and user details
    try {
      await joinedEvents.insertOne({
        eventId: event._id,
        userEmail,
        userName: userName || "",
        title: event.title,
        thumbnail: event.thumbnail,
        location: event.location,
        eventType: event.eventType,
        eventDate: event.eventDate,
        joinedAt: new Date(),
      });
    } catch (error) {
      // 11000 means the unique index found this user already joined this event
      if (error.code === 11000) {
        return res.status(409).json({ message: "You have already joined this event." });
      }
      throw error;
    }

    await events.updateOne({ _id: event._id }, { $inc: { volunteersCount: 1 } });

    res.status(201).json({ message: "You have joined this event." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not join the event." });
  }
});

// Has this user already joined this event?
app.get("/events/:id/is-joined", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const email  = req.user.email; 

    if (!ObjectId.isValid(id) || !email) {
      return res.json({ joined: false });
    }

    const record = await joinedEvents.findOne({
      eventId: new ObjectId(id),
      userEmail: email,
    });

    res.json({ joined: Boolean(record) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not check your join status." });
  }
});

// ---------- Joined events list ----------

app.get("/joined-events", verifyToken, async (req, res) => {
  try {
    const { email } = req.user.email;

    // Only this user's joins, soonest event first
    const joined = await joinedEvents
      .find({ userEmail: email })
      .sort({ eventDate: 1 })
      .toArray();

    res.json(joined);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your joined events." });
  }
});

if(!process.env.VERCEL){
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default  app;