[out:json][timeout:170];
area["ISO3166-1"="MA"][admin_level=2]->.ma;
(
  node["place"~"^(city|town)$"](area.ma);
  nwr["amenity"="school"]["name"](area.ma);
);
out center tags;
