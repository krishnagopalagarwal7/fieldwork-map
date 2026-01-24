/* ---------- Map ---------- */
const map = L.map("map", {
  zoomControl: true,
  attributionControl: false
});

map.createPane("labels");
map.getPane("labels").style.zIndex = 650;

const stateLabelLayer = L.layerGroup();
const districtLabelLayer = L.layerGroup();

const colors = ["#cfe8f3", "#e6f2c2", "#fde2c6", "#e0d4f7"];
let colorIndex = 0;

function styleFn() {
  return {
    fillColor: colors[colorIndex++ % colors.length],
    fillOpacity: 0.7,
    color: "#555",
    weight: 1
  };
}

fetch("data/india_boundary.geojson")
  .then(r => r.json())
  .then(data => {

    const states = {};

    const geojson = L.geoJSON(data, {
      style: styleFn,
      onEachFeature: (feature, layer) => {
        const state = feature.properties.st_nm;
        const district = feature.properties.district;
        if (!state) return;

        if (!states[state]) states[state] = L.latLngBounds([]);
        states[state].extend(layer.getBounds());

        if (district) {
          L.marker(layer.getBounds().getCenter(), {
            pane: "labels",
            interactive: false,
            icon: L.divIcon({
              className: "district-label",
              html: district
            })
          }).addTo(districtLabelLayer);
        }
      }
    }).addTo(map);

    Object.entries(states).forEach(([state, bounds]) => {
      L.marker(bounds.getCenter(), {
        pane: "labels",
        interactive: false,
        icon: L.divIcon({
          className: "state-label",
          html: state
        })
      }).addTo(stateLabelLayer);
    });

    map.fitBounds(geojson.getBounds(), { maxZoom: 6 });
    updateLabels();
  });

function updateLabels() {
  const z = map.getZoom();
  z < 9 ? map.addLayer(stateLabelLayer) : map.removeLayer(stateLabelLayer);
  z >= 7 ? map.addLayer(districtLabelLayer) : map.removeLayer(districtLabelLayer);
}

map.on("zoomend", updateLabels);

/* ---------- Carousel ---------- */
document.addEventListener("DOMContentLoaded", () => {

  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const images = Array.from(track.children);
  const dotsContainer = document.querySelector(".dots");
  let index = 0;

  images.forEach((_, i) => {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active");
    dot.onclick = () => goTo(i);
    dotsContainer.appendChild(dot);
  });

  const dots = Array.from(dotsContainer.children);

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach(d => d.classList.remove("active"));
    dots[index].classList.add("active");
  }

  function goTo(i) {
    index = i;
    update();
  }

  document.querySelector(".next").onclick = () => {
    index = (index + 1) % images.length;
    update();
  };

  document.querySelector(".prev").onclick = () => {
    index = (index - 1 + images.length) % images.length;
    update();
  };

  setInterval(() => {
    index = (index + 1) % images.length;
    update();
  }, 3000);
});
