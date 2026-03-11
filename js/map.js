/* FIELDWORK INDIA — map.js */

// Map Init
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  preferCanvas: true
});

L.control.zoom({ position: "bottomleft" }).addTo(map);

// Tile Layer
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  maxZoom: 18
}).addTo(map);

// Panes
map.createPane("labels");
map.getPane("labels").style.zIndex = 650;
map.getPane("labels").style.pointerEvents = "none";

// Label Layers
const stateLabelLayer    = L.layerGroup();
const districtLabelLayer = L.layerGroup();

// State color palette
const statePalette = [
  "#dde9f0","#e5edd9","#faecd4","#e8dff5",
  "#d9eee6","#fce8d4","#dce6f4","#f0e4d4"
];
let paletteIdx = 0;
const stateColorMap = {};

function getStateColor(state) {
  if (!stateColorMap[state]) {
    stateColorMap[state] = statePalette[paletteIdx++ % statePalette.length];
  }
  return stateColorMap[state];
}

function styleFn(feature) {
  const state = feature.properties.st_nm || "";
  return {
    fillColor: getStateColor(state),
    fillOpacity: 0.75,
    color: "#b5b0a8",
    weight: 0.8
  };
}

// Scheme colors
const schemeColors = {
  MDM:   "#e67e22",
  ICDS:  "#27ae60",
  PDS:   "#2980b9",
  NREGA: "#8e44ad"
};

// State
let currentScheme    = "ALL";
let videoMarkerLayer = L.layerGroup().addTo(map);
let allVideoData     = [];

// Video Panel elements
const videoPanel = document.getElementById("videoPanel");
const vpOverlay  = document.getElementById("vpOverlay");
const vpClose    = document.getElementById("vpClose");
const vpScheme   = document.getElementById("vpScheme");
const vpDistrict = document.getElementById("vpDistrict");
const vpVideos   = document.getElementById("vpVideos");

function openVideoPanel(entry) {
  vpScheme.textContent = entry.scheme;
  vpScheme.style.background = schemeColors[entry.scheme] || "#888";
  vpDistrict.textContent = entry.district;

  vpVideos.innerHTML = "";
  (entry.videos || []).forEach(v => {
    const item = document.createElement("div");
    item.className = "vp-video-item";
    item.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${v.id}?rel=0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy">
      </iframe>
      <div class="vp-video-title">${v.title || "Field Video"}</div>
    `;
    vpVideos.appendChild(item);
  });

  videoPanel.classList.remove("hidden");
  videoPanel.classList.add("slide-in");
  vpOverlay.classList.remove("hidden");
}

function closeVideoPanel() {
  videoPanel.classList.add("hidden");
  videoPanel.classList.remove("slide-in");
  vpOverlay.classList.add("hidden");
  vpVideos.innerHTML = "";
}

vpClose.addEventListener("click", closeVideoPanel);
vpOverlay.addEventListener("click", closeVideoPanel);

// Custom pin icon
function pinIcon(scheme) {
  const color = schemeColors[scheme] || "#888";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
    <polygon points="5,3 19,12 5,21"/>
  </svg>`;
  return L.divIcon({
    className: "video-pin",
    html: `<div class="video-pin-inner" style="background:${color}">${svg}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
  });
}

// Render markers
function renderVideoMarkers(data) {
  videoMarkerLayer.clearLayers();
  const filtered = currentScheme === "ALL"
    ? data
    : data.filter(d => d.scheme === currentScheme);

  filtered.forEach(entry => {
    const marker = L.marker([entry.lat, entry.lng], { icon: pinIcon(entry.scheme) });

    marker.on("click", () => openVideoPanel(entry));

    const popupHtml = `
      <div style="font-family:'DM Mono',monospace;font-size:11px;min-width:140px;">
        <div style="font-size:14px;font-family:'Playfair Display',serif;font-weight:700;margin-bottom:4px">${entry.district}</div>
        <div style="color:#888;letter-spacing:1px;text-transform:uppercase;font-size:9px;margin-bottom:6px">${entry.scheme}</div>
        <div style="color:#c8401a;font-size:11px;cursor:pointer">▶ ${(entry.videos || []).length} video${entry.videos.length !== 1 ? "s" : ""} — click to watch</div>
      </div>
    `;
    marker.bindPopup(popupHtml, { closeButton: false, maxWidth: 200 });
    marker.on("mouseover", function() { this.openPopup(); });
    marker.on("mouseout",  function() { this.closePopup(); });

    videoMarkerLayer.addLayer(marker);
  });

  updateStats(filtered);
}

// Update stats
function updateStats(filtered) {
  const districts = new Set(filtered.map(d => d.district)).size;
  const videos    = filtered.reduce((s, d) => s + (d.videos || []).length, 0);
  document.getElementById("districtStat").textContent = districts;
  document.getElementById("videoStat").textContent    = videos;
  document.getElementById("videoCount").textContent   = `${videos} video${videos !== 1 ? "s" : ""} across ${districts} district${districts !== 1 ? "s" : ""}`;
}

// GeoJSON boundary
fetch("./data/india_boundary.geojson")
  .then(r => r.json())
  .then(data => {
    const statesMap = {};
    const geojson = L.geoJSON(data, {
      style: styleFn,
      onEachFeature: (feature, layer) => {
        const state    = feature.properties.st_nm;
        const district = feature.properties.district;
        if (!state) return;

        if (!statesMap[state]) statesMap[state] = L.latLngBounds([]);
        statesMap[state].extend(layer.getBounds());

        layer.on("mouseover", function() {
          this.setStyle({ fillOpacity: 0.92, weight: 1.5, color: "#888" });
        });
        layer.on("mouseout", function() { geojson.resetStyle(this); });

        if (district) {
          L.marker(layer.getBounds().getCenter(), {
            pane: "labels",
            interactive: false,
            icon: L.divIcon({ className: "district-label", html: district })
          }).addTo(districtLabelLayer);
        }
      }
    }).addTo(map);

    Object.entries(statesMap).forEach(([state, bounds]) => {
      L.marker(bounds.getCenter(), {
        pane: "labels",
        interactive: false,
        icon: L.divIcon({ className: "state-label", html: state })
      }).addTo(stateLabelLayer);
    });

    map.fitBounds(geojson.getBounds(), { padding: [20, 20], maxZoom: 6 });
    updateLabels();
  })
  .catch(() => {
    map.setView([20.5937, 78.9629], 5);
  });

// Load video data
fetch("./data/videos.json")
  .then(r => r.json())
  .then(data => {
    allVideoData = data;
    renderVideoMarkers(allVideoData);
  })
  .catch(() => {
    document.getElementById("videoCount").textContent = "—";
  });

// Label visibility
function updateLabels() {
  const z = map.getZoom();
  if (z < 9) map.addLayer(stateLabelLayer);   else map.removeLayer(stateLabelLayer);
  if (z >= 7) map.addLayer(districtLabelLayer); else map.removeLayer(districtLabelLayer);
}

map.on("zoomend", updateLabels);

// Scheme pills
document.querySelectorAll(".pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentScheme = btn.dataset.scheme;
    closeVideoPanel();
    renderVideoMarkers(allVideoData);
  });
});

// Carousel
document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const slides        = Array.from(track.children);
  const dotsContainer = document.querySelector(".dots");
  let idx = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  const dots = Array.from(dotsContainer.children);

  function update() {
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach(d => d.classList.remove("active"));
    dots[idx].classList.add("active");
  }

  function goTo(i) { idx = i; update(); }

  document.querySelector(".next").addEventListener("click", () => {
    idx = (idx + 1) % slides.length; update();
  });
  document.querySelector(".prev").addEventListener("click", () => {
    idx = (idx - 1 + slides.length) % slides.length; update();
  });

  setInterval(() => { idx = (idx + 1) % slides.length; update(); }, 4000);
});