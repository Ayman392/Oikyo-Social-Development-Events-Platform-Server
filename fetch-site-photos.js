import "dotenv/config";
import fs from "fs";

// Finds real photos on Unsplash for the Hero carousel and the Gallery.
// A photo is only accepted when its description mentions the right topic,
// and is skipped when the description has an unwanted word.

const accessKey = process.env.UNSPLASH_ACCESS_KEY;
if (!accessKey) {
  process.exit(1);
}

// Photos whose description contains any of these words are never used
const bannedWords = [
  "knife", "flag", "protest", "rally", "crowd", "political", "military", "soldier",
  "gun", "weapon", "police", "text", "poster", "advert", "logo", "icon", "graphic",
  "banner", "illustration", "vector", "screen",
];

// ---------- What to look for ----------

const heroSearches = [
  {
    phrase: "volunteers working together",
    must: ["volunteer", "team", "together", "group"],
    alt: "Volunteers working together on a community project",
  },
  {
    phrase: "planting trees",
    must: ["tree", "plant", "sapling", "seedling", "forest"],
    alt: "People planting young trees",
  },
  {
    phrase: "volunteers distributing food",
    must: ["food", "meal", "volunteer", "donat", "distribut"],
    alt: "Volunteers distributing food to families",
  },
  {
    phrase: "children learning school",
    must: ["child", "kid", "student", "school", "classroom", "learn"],
    alt: "Children learning together at school",
  },
];

const gallerySearches = [
  {
    phrase: "volunteers cleaning beach trash",
    must: ["clean", "trash", "litter", "garbage", "waste", "volunteer"],
    alt: "Volunteers cleaning up litter together",
  },
  {
    phrase: "planting a tree sapling",
    must: ["tree", "plant", "sapling", "seedling", "garden"],
    alt: "Hands planting a tree sapling",
  },
  {
    phrase: "charity donation clothes",
    must: ["donat", "clothes", "box", "charity", "volunteer"],
    alt: "Donated clothes packed for families in need",
  },
  {
    phrase: "children classroom",
    must: ["child", "kid", "student", "school", "classroom"],
    alt: "Children learning together in a classroom",
  },
  {
    phrase: "blood donation doctor",
    must: ["doctor", "nurse", "blood", "patient", "clinic", "medical", "health"],
    alt: "Medical care at a community health camp",
  },
  {
    phrase: "volunteers serving food charity",
    must: ["food", "meal", "serving", "volunteer", "charity"],
    alt: "Volunteers serving meals to people in need",
  },
];

// ---------- Helpers ----------

async function search(query, orientation) {
  const url =
    "https://api.unsplash.com/search/photos" +
    `?query=${encodeURIComponent(query)}&per_page=30&orientation=${orientation}`;

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });

  if (res.status === 403) {
    throw new Error("Unsplash says the hourly limit is used up. Wait an hour and run this again.");
  }
  if (!res.ok) {
    throw new Error(`Unsplash replied with status ${res.status}. Check your access key.`);
  }
  const data = await res.json();
  return data.results;
}

const usedIds = new Set(); // no photo is used twice

function isGoodMatch(photo, item) {
  if (usedIds.has(photo.id)) return false;

  const text = `${photo.alt_description || ""} ${photo.description || ""}`.toLowerCase();
  if (bannedWords.some((word) => text.includes(word))) return false;

  return item.must.some((word) => text.includes(word));
}

// Try a Bangladesh photo first, then any matching photo
async function findPhoto(item, orientation) {
  for (const query of [`${item.phrase} Bangladesh`, item.phrase]) {
    const results = await search(query, orientation);
    const photo = results.find((p) => isGoodMatch(p, item));

    if (photo) {
      usedIds.add(photo.id);
      return photo;
    }
  }
  return null;
}

function makeUrl(photo, width) {
  const raw = photo.urls.raw;
  const joiner = raw.includes("?") ? "&" : "?";
  return `${raw}${joiner}auto=format&fit=crop&q=80&w=${width}`;
}

async function collect(searches, orientation, width) {
  const found = [];

  for (const item of searches) {
    const photo = await findPhoto(item, orientation);

    if (!photo) {
      console.log(`No good match found for "${item.phrase}". Skipping it.`);
      continue;
    }

    found.push({
      src: makeUrl(photo, width),
      alt: item.alt,
      shows: photo.alt_description || "no description",
      credit: `Photo by ${photo.user.name} on Unsplash`,
    });
  }
  return found;
}

function printList(title, list) {
  console.log(`\n${title}\n`);
  for (const photo of list) {
    console.log(`  // shows: ${photo.shows}`);
    console.log("  {");
    console.log(`    src: "${photo.src}",`);
    console.log(`    alt: "${photo.alt}",`);
    console.log("  },");
  }
}

// ---------- Run ----------

const hero = await collect(heroSearches, "landscape", 2000);
const gallery = await collect(gallerySearches, "squarish", 800);

fs.writeFileSync("./site-photos.json", JSON.stringify({ hero, gallery }, null, 2) + "\n");

printList("HERO SLIDES (for the carousel)", hero);
printList("GALLERY (for the gallery section)", gallery);

console.log("\nAlso saved to site-photos.json");