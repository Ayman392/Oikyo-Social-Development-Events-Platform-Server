export function getCoordinatesError(coordinates) {
  if (coordinates === undefined || coordinates === null) {
    return null;
  }

  if (
    typeof coordinates !== "object" ||
    Array.isArray(coordinates) ||
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    return "Coordinates must include a valid latitude and longitude.";
  }

  return null;
}

export function toEventCoordinates(coordinates) {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
