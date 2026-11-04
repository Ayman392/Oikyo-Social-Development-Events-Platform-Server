import test from "node:test";
import assert from "node:assert/strict";
import { getCoordinatesError, toEventCoordinates } from "./event-coordinates.js";

test("coordinates are optional for existing and new events", () => {
  assert.equal(getCoordinatesError(undefined), null);
  assert.equal(getCoordinatesError(null), null);
});

test("accepts valid organizer-confirmed geographic coordinates", () => {
  const coordinates = { latitude: 23.8103, longitude: 90.4125 };

  assert.equal(getCoordinatesError(coordinates), null);
  assert.deepEqual(toEventCoordinates(coordinates), coordinates);
});

test("accepts coordinates at geographic boundaries", () => {
  assert.equal(getCoordinatesError({ latitude: -90, longitude: -180 }), null);
  assert.equal(getCoordinatesError({ latitude: 90, longitude: 180 }), null);
});

test("rejects malformed, non-finite, and out-of-range coordinates", () => {
  for (const coordinates of [
    "23.8103,90.4125",
    [],
    {},
    { latitude: "23.8103", longitude: 90.4125 },
    { latitude: Number.NaN, longitude: 90.4125 },
    { latitude: 91, longitude: 90.4125 },
    { latitude: 23.8103, longitude: -181 },
  ]) {
    assert.ok(getCoordinatesError(coordinates), `expected rejection for ${JSON.stringify(coordinates)}`);
  }
});
