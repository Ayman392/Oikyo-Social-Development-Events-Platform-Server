import "dotenv/config";
import fs from "fs";

// Finds a real, matching photo on Unsplash for every event in events.json
// and saves the links back into the file.

const accessKey = process.env.UNSPLASH_ACCESS_KEY;
if (!accessKey) {
  console.log(
    "Please add UNSPLASH_ACCESS_KEY=your_key to your .env file first.",
  );
  process.exit(1);
}

// What to search for, per event
const searchPhrases = {
  "Sweater Drive for Garment Workers' Families": "children winter clothes",
  "Night Shelter Quilt Giveaway": "blanket donation",
  "Dhanmondi Lake Cleanup Drive": "volunteers cleaning lake",
  "Urban Tree Plantation Day": "volunteers planting trees",
  "Free Evening Classes for Street Children": "children studying classroom",
  "Free Health Checkup Camp": "doctor medical camp",
  "Community Meal Distribution": "volunteers serving food",
  "Buriganga Riverbank Cleanup": "river cleanup volunteers",
  "Rooftop Garden Workshop": "rooftop vegetable garden",
  "Blood Donation Camp": "blood donation",
  "Cox's Bazar Beach Cleanup": "beach cleanup volunteers",
  "School Supplies for Village Children": "school children books",
  "Eye Care Camp for Elders": "eye checkup elderly",
  "Hill Tree Plantation Drive": "hill forest planting",
  "Warm Meals for Rickshaw Pullers": "rickshaw Dhaka",
};

async function search(query) {
  const url =
    "https://api.unsplash.com/search/photos" +
    `?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) {
    throw new Error(
      `Unsplash replied with status ${res.status}. Check your access key.`,
    );
  }
  const data = await res.json();
  return data.results;
}

const events = JSON.parse(fs.readFileSync("./events.json", "utf-8"));
const usedPhotoIds = new Set(); // makes sure no photo is used twice

for (const event of events) {
  const phrase = searchPhrases[event.title] || event.eventType;

  // Try a Bangladesh photo first, then fall back to any matching photo
  let results = await search(`${phrase} Bangladesh`);
  let photo = results.find((p) => !usedPhotoIds.has(p.id));

  if (!photo) {
    results = await search(phrase);
    photo = results.find((p) => !usedPhotoIds.has(p.id));
  }

  if (!photo) {
    console.log(`No photo found for "${event.title}", keeping the old one.`);
    continue;
  }

  usedPhotoIds.add(photo.id);

  const raw = photo.urls.raw;
  const joiner = raw.includes("?") ? "&" : "?";
  event.thumbnail = `${raw}${joiner}auto=format&fit=crop&q=80&w=1200`;
  event.photoCredit = `Photo by ${photo.user.name} on Unsplash`;

  console.log(`${event.title}  ->  ${photo.alt_description || "photo found"}`);
}

fs.writeFileSync("./events.json", JSON.stringify(events, null, 2) + "\n");
console.log(
  "\nDone. events.json now has matching photos. Run: node import-events.js",
);
