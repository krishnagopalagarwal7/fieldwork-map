const map = L.map("map", {
  zoomControl: true,
  attributionControl: false
});

/* ---------- panes ---------- */
map.createPane("labels");
map.getPane("labels").style.zIndex = 650;

map.createPane("videos");
map.getPane("videos").style.zIndex = 660;
/* --------------------------- */

const stateLabelLayer = L.layerGroup();
const districtLabelLayer = L.layerGroup();
const videoLayer = L.layerGroup().addTo(map);

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

/* ---------------- GEOJSON ---------------- */

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

        if (!states[state]) {
          states[state] = L.latLngBounds([]);
        }
        states[state].extend(layer.getBounds());

        if (district) {
          L.marker(layer.getBounds().getCenter(), {
            pane: "labels",
            interactive: false,
            icon: L.divIcon({
              className: "district-label",
              html: district,
              iconSize: [1, 1]
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
          html: state,
          iconSize: [1, 1]
        })
      }).addTo(stateLabelLayer);
    });

    map.fitBounds(geojson.getBounds(), {
  padding: [20, 20],
  maxZoom: 6
});

    updateLabels();
  });

/* ---------------- ZOOM LOGIC ---------------- */

function updateLabels() {
  const z = map.getZoom();

  /* State labels only at lower zooms */
  if (z < 9) {
    map.addLayer(stateLabelLayer);
  } else {
    map.removeLayer(stateLabelLayer);
  }

  /* District labels only at higher zooms */
  if (z >= 7) {
    map.addLayer(districtLabelLayer);
  } else {
    map.removeLayer(districtLabelLayer);
  }
}

map.on("zoomend", updateLabels);

/* ---------------- VIDEO MARKERS ---------------- */

const youtubeIcon = L.divIcon({
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
  html: `
    <svg viewBox="0 0 24 24" width="20" height="20">
      <circle cx="12" cy="12" r="11" fill="#e53935"/>
      <polygon points="10,8 17,12 10,16" fill="#fff"/>
    </svg>
  `
}); 

let allVideos = [];

fetch("data/videos.json")
  .then(r => r.json())
  .then(videos => {
    allVideos = videos;
    renderVideos("ALL");
  });

function renderVideos(scheme) {
  videoLayer.clearLayers();

  allVideos
    .filter(v => scheme === "ALL" || v.scheme === scheme)
    .forEach(v => {
      L.marker([v.lat, v.lng], {
        pane: "videos",
        icon: youtubeIcon
      })
      .addTo(videoLayer)
      .bindPopup(`
        <strong>${v.district}</strong><br>
        Scheme: ${v.scheme}<br><br>
        ${v.videos.map(vid =>
          `<a href="https://www.youtube.com/watch?v=${vid.id}"
             target="_blank"
             rel="noopener noreferrer">
            ▶ ${vid.title}
          </a>`
        ).join("<br>")}
      `);
    });
}

document
  .getElementById("schemeSelect")
  .addEventListener("change", e => {
    renderVideos(e.target.value);
  });
