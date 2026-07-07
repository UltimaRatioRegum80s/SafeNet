export const countries = ['Namibia', 'South Africa', 'Botswana'] as const;
export type Country = typeof countries[number];

export const citiesByCountry: Record<Country, string[]> = {
  'Namibia': [
    'Windhoek', 'Swakopmund', 'Walvis Bay', 'Rehoboth', 'Oshakati', 'Rundu', 'Otjiwarongo', 
    'Gobabis', 'Katima Mulilo', 'Tsumeb', 'Keetmanshoop', 'Ongwediva', 'Okahandja', 
    'Oshikango', 'Lüderitz', 'Mariental', 'Usakos', 'Henties Bay', 'Omaruru', 'Otavi',
    'Outapi', 'Eenhana', 'Ondangwa', 'Oshikuku', 'Ruacana', 'Opuwo', 'Omuthiya', 
    'Okakarara', 'Grootfontein', 'Karibib', 'Kamanjab', 'Oranjemund', 'Aranos',
    'Bethanien', 'Gibeon', 'Kalkrand', 'Maltahöhe', 'Stampriet', 'Witvlei'
  ],
  'South Africa': [
    'Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein',
    'East London', 'Nelspruit', 'Polokwane', 'Kimberley', 'Rustenburg', 'Pietermaritzburg',
    'Witbank', 'Vereeniging', 'Welkom', 'Vanderbijlpark', 'Sasolburg', 'Kroonstad',
    'Potchefstroom', 'Carletonville', 'Klerksdorp', 'Middelburg', 'Secunda', 'Standerton',
    'Newcastle', 'Ladysmith', 'Dundee', 'Vryheid', 'Richards Bay', 'Empangeni',
    'Stanger', 'Pinetown', 'Chatsworth', 'Phoenix', 'Umlazi', 'Khayelitsha',
    'Mitchells Plain', 'Soweto', 'Alexandra', 'Sandton', 'Randburg', 'Roodepoort',
    'Benoni', 'Boksburg', 'Germiston', 'Springs', 'Alberton', 'Edenvale'
  ],
  'Botswana': [
    'Gaborone', 'Francistown', 'Molepolole', 'Serowe', 'Selibe Phikwe', 'Maun', 'Kanye',
    'Mochudi', 'Mahalapye', 'Palapye', 'Tlokweng', 'Lobatse', 'Tonota', 'Moshupa',
    'Thamaga', 'Gabane', 'Jwaneng', 'Kasane', 'Letlhakane', 'Ramotswa', 'Goodhope',
    'Bobonong', 'Maunatlala', 'Shoshong', 'Tutume', 'Nata', 'Sua Pan', 'Orapa',
    'Ghantsi', 'Tsabong', 'Kang', 'Hukuntsi', 'Tshane', 'Werda', 'Bokspits'
  ]
};

export const neighbourhoodsByCity: Record<string, string[]> = {
  // Namibia - Windhoek (comprehensive authentic neighbourhoods)
  'Windhoek': [
    'Academia', 'Auasblick', 'Avis', 'Cimbebasia', 'Dorado Park', 'Eros', 'Goreangab', 
    'Groot Aub', 'Brakwater', 'Hakahana', 'Hochland Park', 'Katutura', 'Khomasdal', 
    'Kleine Kuppe', 'Klein Windhoek', 'Lafrenz Industrial Area', 'Ludwigsdorf', 'Luxury Hill', 
    'Northern Industrial Area', 'Okuryangava', 'Olympia', 'Otjomuise', 'Pioneers Park', 
    'Prosperita', 'Rocky Crest', 'Southern Industrial Area', 'Suiderhof', 'Tauben Glen', 
    'Wanaheda', 'Windhoek Central', 'Windhoek North', 'Windhoek West'
  ],
  'Swakopmund': [
    'Town Centre', 'Vineta', 'Mile 4', 'Ocean View', 'Kramersdorf', 'Vogelstrand', 
    'Waterfront', 'Mondesa', 'Matutura', 'Industrial Area', 'Tamariskia', 'DRC'
  ],
  'Walvis Bay': [
    'Afrodite Beach', 'Dolphin Beach', 'Fairways Estate', 'Hermes', 'Kuisebmond', 
    'Lagoon', 'Light Industrial', 'Long Beach', 'Meersig', 'Narraville', 'Walvis Bay Central'
  ],
  'Rehoboth': [
    'Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Block F', 'Block G', 'Block H'
  ],
  'Okahandja': [
    'Okahandja Central', 'Osona Village'
  ],
  'Otjiwarongo': [
    'Orwetoveni', 'Otjiwarongo Central'
  ],
  'Tsumeb': [
    'Nomtsoub', 'Tsumeb Central'
  ],
  'Rundu': [
    'Katutura', 'Tutungeni', 'Safari', 'Millennium Park', 'Queens Park', 'Kings Park', 
    'Rainbow', 'Kehemu', 'Kaisosi', 'Sauyemwa', 'Ndama', 'Donkerhoek'
  ],
  'Oshakati': [
    'Oshakati West', 'Oshakati East', 'Uupindi North', 'Uupindi South', 'Ompumbu', 
    'Oshoopala', 'Ehenye', 'Oneshila', 'Ekuku'
  ],
  'Ongwediva': [
    'Extension 13', 'Extension 14', 'Extension 15', 'Extension 17', 'Kandjengedi', 'Evululuko'
  ],
  'Katima Mulilo': [
    'Nghweeze', 'Katima Mulilo Proper', 'Butterfly', 'Cowboy', 'Choto', 'Mahohoma', 
    'Nambweza', 'Soweto', 'New Look', 'Mabuluma', 'Lyambai', 'Bebi', 'Greenwell Matongo', 
    'Macaravan East', 'Macaravan West', 'NHE'
  ],
  'Keetmanshoop': [
    'Noordhoek', 'Westdene', 'Krönlein', 'Tseiblaagte'
  ],
  'Lüderitz': [
    'Waterfront', 'Buchta', 'Klingbeil'
  ],
  'Gobabis': [
    'Epako', 'Nossobville', 'Gobabis Industrial Centre', 'Freedom Square'
  ],
  'Mariental': [
    'Mariental proper', 'Sonop', 'Aimablaagte', 'Empelheim'
  ],
  'Outapi': [
    'Onhimbu', 'Tobia Hainyeko', 'Okae Kongwe'
  ],
  'Eenhana': [
    'Eenhana Central'
  ],
  'Okakarara': [
    'Pamue', 'Okakarara Proper'
  ],
  'Omuthiya': [
    'Omuthiya Proper', 'Extension 5'
  ],

  // South Africa - Cape Town
  'Cape Town': [
    'City Bowl', 'Atlantic Seaboard', 'Southern Suburbs', 'Northern Suburbs', 'Cape Flats',
    'Sea Point', 'Green Point', 'Waterfront', 'Observatory', 'Woodstock', 'Salt River',
    'Claremont', 'Rondebosch', 'Newlands', 'Constantia', 'Hout Bay', 'Camps Bay',
    'Clifton', 'Bantry Bay', 'Fresnaye', 'Mouille Point', 'De Waterkant', 'Bo-Kaap',
    'Gardens', 'Tamboerskloof', 'Higgovale', 'Oranjezicht', 'Vredehoek', 'Zonnebloem',
    'District Six', 'East City', 'Foreshore', 'Schotsche Kloof', 'Walmer Estate'
  ],
  'Johannesburg': [
    'Sandton', 'Rosebank', 'Melville', 'Parkhurst', 'Parktown', 'Houghton', 'Hyde Park',
    'Illovo', 'Morningside', 'Rivonia', 'Bryanston', 'Randburg', 'Fourways', 'Midrand',
    'Alexandra', 'Soweto', 'Roodepoort', 'Germiston', 'Benoni', 'Boksburg', 'Springs',
    'Kempton Park', 'Edenvale', 'Bedfordview', 'Greenstone', 'Northcliff', 'Emmarentia'
  ],
  'Durban': [
    'Berea', 'Morningside', 'Musgrave', 'Glenwood', 'Umbilo', 'Cato Manor', 'Pinetown',
    'Chatsworth', 'Phoenix', 'Umlazi', 'KwaMashu', 'Inanda', 'Ntuzuma', 'Newlands East',
    'Westville', 'Kloof', 'Hillcrest', 'Gillitts', 'Waterfall', 'Durban North'
  ],
  'Pretoria': [
    'Arcadia', 'Hatfield', 'Brooklyn', 'Menlo Park', 'Lynnwood', 'Waterkloof', 'Garsfontein',
    'Centurion', 'Irene', 'Cornwall Hill', 'Erasmuskloof', 'Faerie Glen', 'Moreleta Park',
    'Willow Park Manor', 'Silver Lakes', 'Die Wilgers', 'Menlyn', 'Lyttelton Manor'
  ],

  // Botswana - Gaborone
  'Gaborone': [
    'Main Mall', 'Village', 'Extension 2', 'Extension 4', 'Extension 6', 'Extension 9',
    'Extension 10', 'Extension 11', 'Extension 12', 'Extension 14', 'Extension 15',
    'Extension 16', 'Phakalane', 'Mogoditshane', 'Gabane', 'Kumakwane', 'Tlokweng',
    'Block 3', 'Block 6', 'Block 7', 'Block 8', 'Block 9', 'Block 10', 'Broadhurst',
    'Old Naledi', 'New Naledi', 'White City', 'Sebele', 'G-West'
  ],
  'Francistown': [
    'Aerodrome', 'Blue Jacket Street', 'Donga', 'Extension 2', 'Extension 4', 'Gerald Estate',
    'Monarch', 'Newtown', 'Tati Siding', 'Township', 'Woodlands', 'Satellite', 'Beacon Hill'
  ]
};