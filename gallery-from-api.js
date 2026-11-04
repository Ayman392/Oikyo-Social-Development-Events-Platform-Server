// Prints gallery photos taken from your own event data (the live API),
// one event of each type, ready to paste into Gallery.tsx.
//
// Run it in the Server folder:   node gallery-from-api.js
// To read your local API instead: API_URL=http://localhost:5000 node gallery-from-api.js

const API_URL = process.env.API_URL || "https://social-development-events-platform-three.vercel.app";

const res = await fetch(`${API_URL}/events/upcoming`);
if (!res.ok) {
  console.log(`The API replied with status ${res.status}. Check that the server is running.`);
  process.exit(1);
}

const events = await res.json();

// One event for each type, so the gallery shows different kinds of work
const typesWanted = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Education",
  "Health Camp",
  "Food Distribution",
];

const usedPhotos = new Set();
const picked = [];

for (const type of typesWanted) {
  const event = events.find(
    (e) => e.eventType === type && e.thumbnail && !usedPhotos.has(e.thumbnail)
  );

  if (!event) {
    console.log(`// No event of type "${type}" was found, so it is skipped.`);
    continue;
  }

  usedPhotos.add(event.thumbnail);
  picked.push({
    type,
    title: event.title,
    // The gallery uses 800px photos, and the large view swaps w=800 for w=1600
    src: event.thumbnail.replace(/w=\d+/, "w=800"),
  });
}

console.log(`Found ${picked.length} photos from ${events.length} events.\n`);
console.log("Paste this into the photos list in Gallery.tsx:\n");

for (const item of picked) {
  console.log(`  // ${item.type}: ${item.title}`);
  console.log("  {");
  console.log(`    src: "${item.src}",`);
  console.log(`    alt: "${item.title.replace(/"/g, '\\"')}",`);
  console.log("  },");
}