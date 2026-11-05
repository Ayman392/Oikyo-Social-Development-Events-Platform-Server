const key = process.env.UNSPLASH_ACCESS_KEY;

const searches = [
  { query: "volunteers river cleanup bangladesh", alt: "Volunteers cleaning up a riverbank" },
  { query: "tree planting volunteers community", alt: "Volunteers planting trees together" },
  { query: "winter clothes donation charity", alt: "Winter clothes being donated to families" },
  { query: "village school children bangladesh", alt: "Children at a free community class" },
  { query: "free medical camp doctor village", alt: "A free health camp for local residents" },
  { query: "volunteers distributing food packages", alt: "Food packages being handed out to families" },
];

for (const { query, alt } of searches) {
  const url =
    "https://api.unsplash.com/search/photos?per_page=1&orientation=squarish&query=" +
    encodeURIComponent(query);

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) {
    console.log(`// FAILED (${res.status}): ${query}`);
    continue;
  }

  const { results } = await res.json();
  const photo = results[0];

  if (!photo) {
    console.log(`// NO RESULT: ${query}`);
    continue;
  }

  console.log(`  // Photo by ${photo.user.name} on Unsplash`);
  console.log(`  { src: "${photo.urls.regular}", alt: "${alt}" },`);
}