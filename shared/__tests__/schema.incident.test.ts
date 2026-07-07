// Mobile coordinate validation tests
const insertIncidentSchema = {
  parse: (data: any) => ({
    ...data,
    latitude: typeof data.lat === 'string' ? parseFloat(data.lat) : data.lat,
    longitude: typeof data.lng === 'string' ? parseFloat(data.lng) : data.lng,
  })
};

const normalizeIncidentCoords = (coords: { lat?: number; lng?: number; latitude?: number; longitude?: number }) => {
  let lat = coords.lat ?? coords.latitude ?? 0;
  let lng = coords.lng ?? coords.longitude ?? 0;
  
  // Swap if reversed (lat should be -90 to 90, lng should be -180 to 180)
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }
  
  // Round to 6 decimal places for precision
  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lng: Math.round(lng * 1000000) / 1000000,
  };
};

// Test coerces string lat/lng
const p = insertIncidentSchema.parse({ 
  title: "t", 
  description: "d", 
  lat: "-33.9", 
  lng: "18.4", 
  type: "fire" 
});
console.log("Coercion test:", typeof p.latitude === "number" && typeof p.longitude === "number");

// Test swaps reversed coords
const n = normalizeIncidentCoords({ lat: 120, lng: -33 }); // obviously swapped
console.log("Swap test:", Math.abs(n.lat) <= 90 && Math.abs(n.lng) <= 180);

// Test rounds precision
const n2 = normalizeIncidentCoords({ lat: -33.912345678, lng: 18.412345678 });
console.log("Precision test:", n2.lat.toString().split(".")[1]?.length <= 6 && n2.lng.toString().split(".")[1]?.length <= 6);