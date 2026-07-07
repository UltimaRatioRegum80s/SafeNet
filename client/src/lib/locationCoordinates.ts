// Location coordinates for cities and towns in Namibia, South Africa, and Botswana
// Format: [latitude, longitude]

export interface CityCoordinates {
  [city: string]: [number, number];
}

export const namibianCities: CityCoordinates = {
  // Major cities
  "Windhoek": [-22.5609, 17.0658],
  "Swakopmund": [-22.6792, 14.5272],
  "Walvis Bay": [-22.9576, 14.5053],
  "Oshakati": [-17.7889, 15.6982],
  "Rundu": [-17.9336, 19.7610],
  "Rehoboth": [-23.3175, 17.0844],
  "Katima Mulilo": [-17.5017, 24.2663],
  "Otjiwarongo": [-20.4638, 16.6475],
  "Gobabis": [-22.4504, 18.9682],
  "Henties Bay": [-22.1167, 14.2833],
  "Okahandja": [-21.9814, 16.9178],
  "Grootfontein": [-19.5695, 18.1178],
  "Tsumeb": [-19.2472, 17.7194],
  "Mariental": [-24.6314, 17.9614],
  "Keetmanshoop": [-26.5800, 18.1264],
  "Luderitz": [-26.6484, 15.1594],
  "Ondangwa": [-17.9167, 15.9500],
  "Ongwediva": [-17.7833, 15.7667],
  "Outjo": [-20.1167, 16.1500],
  "Omaruru": [-21.4333, 15.9333],
  "Karibib": [-21.9333, 15.8333],
  "Usakos": [-22.0000, 15.6000],
  "Otavi": [-19.6500, 17.3333],
  "Opuwo": [-18.0600, 13.8400],
  "Okakarara": [-20.5833, 17.4333],
  "Omuthiya": [-18.3667, 16.6833],
  "Outapi": [-17.5000, 14.9833]
};

export const southAfricanCities: CityCoordinates = {
  // Major cities and towns
  "Cape Town": [-33.9249, 18.4241],
  "Johannesburg": [-26.2041, 28.0473],
  "Durban": [-29.8587, 31.0218],
  "Pretoria": [-25.7479, 28.2293],
  "Port Elizabeth": [-33.9608, 25.6022],
  "Bloemfontein": [-29.0852, 26.1596],
  "East London": [-33.0153, 27.9116],
  "Nelspruit": [-25.4753, 30.9700],
  "Polokwane": [-23.9045, 29.4689],
  "Kimberley": [-28.7282, 24.7499],
  "Upington": [-28.4478, 21.2561],
  "George": [-33.9628, 22.4619],
  "Mossel Bay": [-34.1835, 22.1467],
  "Hermanus": [-34.4187, 19.2345],
  "Stellenbosch": [-33.9321, 18.8602],
  "Paarl": [-33.7437, 18.9707],
  "Worcester": [-33.6464, 19.4483],
  "Oudtshoorn": [-33.5989, 22.2021],
  "Knysna": [-34.0361, 23.0471],
  "Plettenberg Bay": [-34.0527, 23.3716],
  "Springbok": [-29.6647, 17.8856],
  "Calvinia": [-31.4719, 19.7757],
  "Clanwilliam": [-32.1769, 18.8969],
  "Vredenburg": [-32.9081, 17.9814],
  "Saldanha": [-33.0119, 17.9442],
  "Langebaan": [-33.1098, 18.0263],
  "Malmesbury": [-33.4606, 18.7267],
  "Wellington": [-33.6390, 19.0118],
  "Ceres": [-33.3814, 19.3119],
  "Tulbagh": [-33.2836, 19.1447],
  "Robertson": [-33.8047, 19.8886],
  "Montagu": [-33.7886, 20.1219],
  "Swellendam": [-34.0231, 20.4406],
  "Riversdale": [-34.0931, 21.2558],
  "Heidelberg": [-34.0769, 20.9556],
  "Albertinia": [-34.2050, 21.5789],
  "Still Bay": [-34.3689, 21.4278],
  "Gouritsmond": [-34.3700, 21.8800],
  "Ladismith": [-33.4919, 21.2575],
  "Calitzdorp": [-33.5339, 21.6789],
  "De Rust": [-33.4828, 22.4864],
  "Prince Albert": [-33.2267, 22.0331],
  "Beaufort West": [-32.3564, 22.5831],
  "Murraysburg": [-31.9667, 23.7667],
  "Richmond": [-31.2167, 24.1500]
};

export const botswanaCities: CityCoordinates = {
  // Major cities and towns
  "Gaborone": [-24.6282, 25.9231],
  "Francistown": [-21.1594, 27.5081],
  "Molepolole": [-24.4167, 25.4833],
  "Serowe": [-22.3833, 26.7167],
  "Selibe Phikwe": [-22.0081, 27.8478],
  "Maun": [-19.9833, 23.4167],
  "Lobatse": [-25.2167, 25.6667],
  "Palapye": [-22.5500, 27.1167],
  "Ramotswa": [-24.8667, 25.8667],
  "Mochudi": [-24.4333, 25.9833],
  "Mahalapye": [-23.1167, 26.7667],
  "Jwaneng": [-24.6000, 24.7667],
  "Kasane": [-17.8167, 25.1500],
  "Ghanzi": [-21.6833, 21.6167],
  "Tsabong": [-26.0333, 22.4000],
  "Shakawe": [-18.3667, 21.8333],
  "Nata": [-20.2167, 26.1833],
  "Letlhakane": [-21.4167, 25.5833],
  "Orapa": [-21.3167, 25.3833],
  "Sua Pan": [-20.5500, 25.7500],
  "Tuli Block": [-22.1833, 29.2167],
  "Goodhope": [-22.7500, 26.0333],
  "Kanye": [-24.9833, 25.3333],
  "Moshupa": [-24.8167, 25.0333],
  "Thamaga": [-24.6167, 25.5167],
  "Mogoditshane": [-24.6333, 25.8667],
  "Tlokweng": [-24.6833, 25.9833],
  "Gabane": [-24.7167, 25.7167],
  "Kopong": [-24.5333, 25.8833],
  "Mmankgodi": [-24.7500, 25.7833],
  "Metsimotlhabe": [-24.8333, 25.7167],
  "Tsolamosese": [-24.7833, 25.6833],
  "Boatle": [-24.6500, 25.7833],
  "Artesia": [-24.6833, 25.7500]
};

// Combined coordinates lookup
export const allCityCoordinates: CityCoordinates = {
  ...namibianCities,
  ...southAfricanCities,
  ...botswanaCities
};

// Neighborhood to city mapping for better coordinate lookup
const neighborhoodToCityMap: { [neighborhood: string]: string } = {
  // Swakopmund neighborhoods
  'Kramersdorf': 'Swakopmund',
  'Vineta': 'Swakopmund', 
  'Mile 4': 'Swakopmund',
  'Ocean View': 'Swakopmund',
  'Vogelstrand': 'Swakopmund',
  'Waterfront': 'Swakopmund',
  'Mondesa': 'Swakopmund',
  'Matutura': 'Swakopmund',
  'Tamariskia': 'Swakopmund',
  'DRC': 'Swakopmund',
  // Windhoek neighborhoods (subset for major ones)
  'Katutura': 'Windhoek',
  'Khomasdal': 'Windhoek',
  'Dorado Park': 'Windhoek',
  'Klein Windhoek': 'Windhoek',
  'Academia': 'Windhoek',
  'Wanaheda': 'Windhoek'
};

// Function to get coordinates for a city
export function getCityCoordinates(city: string): [number, number] | null {
  // Clean the city name (remove extra spaces, handle case)
  const cleanCity = city.trim();
  
  // First, check if this is a neighborhood that should map to a parent city
  const lowerCity = cleanCity.toLowerCase();
  for (const [neighborhood, parentCity] of Object.entries(neighborhoodToCityMap)) {
    if (neighborhood.toLowerCase() === lowerCity) {
      return allCityCoordinates[parentCity];
    }
  }
  
  // Try exact match for city names
  if (allCityCoordinates[cleanCity]) {
    return allCityCoordinates[cleanCity];
  }
  
  // Try case-insensitive match for city names
  for (const [key, coords] of Object.entries(allCityCoordinates)) {
    if (key.toLowerCase() === lowerCity) {
      return coords;
    }
  }
  
  // Handle "neighborhood, city" format (e.g., "Kramersdorf, Swakopmund")
  if (cleanCity.includes(',')) {
    const parts = cleanCity.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Try the last part (usually the city)
      const cityPart = parts[parts.length - 1];
      if (allCityCoordinates[cityPart]) {
        return allCityCoordinates[cityPart];
      }
      // Try case-insensitive match for the city part
      for (const [key, coords] of Object.entries(allCityCoordinates)) {
        if (key.toLowerCase() === cityPart.toLowerCase()) {
          return coords;
        }
      }
    }
  }
  
  // Try partial match as last resort
  for (const [key, coords] of Object.entries(allCityCoordinates)) {
    if (key.toLowerCase().includes(lowerCity) || lowerCity.includes(key.toLowerCase())) {
      return coords;
    }
  }
  
  // Default to Windhoek, Namibia if no match found
  return [-22.5609, 17.0658];
}

// Function to determine country from city
export function getCityCountry(city: string): string {
  const cleanCity = city.trim();
  
  if (namibianCities[cleanCity]) return 'Namibia';
  if (southAfricanCities[cleanCity]) return 'South Africa';
  if (botswanaCities[cleanCity]) return 'Botswana';
  
  // Try case-insensitive
  const lowerCity = cleanCity.toLowerCase();
  for (const key of Object.keys(namibianCities)) {
    if (key.toLowerCase() === lowerCity) return 'Namibia';
  }
  for (const key of Object.keys(southAfricanCities)) {
    if (key.toLowerCase() === lowerCity) return 'South Africa';
  }
  for (const key of Object.keys(botswanaCities)) {
    if (key.toLowerCase() === lowerCity) return 'Botswana';
  }
  
  return 'Namibia'; // Default
}