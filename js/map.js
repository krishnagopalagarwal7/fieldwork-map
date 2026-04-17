/* FIELDWORK INDIA — map.js */

// ── Map Init ──
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  preferCanvas: false
});

L.control.zoom({ position: "bottomleft" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  maxZoom: 18
}).addTo(map);

map.createPane("labels");
map.getPane("labels").style.zIndex = 650;
map.getPane("labels").style.pointerEvents = "none";

const stateLabelLayer    = L.layerGroup();
const districtLabelLayer = L.layerGroup();

// ── State colors ──
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
  return {
    fillColor: getStateColor(feature.properties.st_nm || ""),
    fillOpacity: 0.75,
    color: "#b5b0a8",
    weight: 0.8
  };
}

// ── Category colors (schemes + topics) ──
const categoryColors = {
  MDM:    "#e67e22",
  ICDS:   "#27ae60",
  PDS:    "#2980b9",
  NREGA:  "#8e44ad",
  Pension:"#c0392b",
  Aadhaar:"#16a085"
};

// ── State ──
let currentScheme    = "ALL";
let pendingScheme    = "ALL";
let allVideoData     = [];

// ── Marker cluster ──
let videoMarkerLayer = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  maxClusterRadius: 40,
  iconCreateFunction(cluster) {
    return L.divIcon({
      html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
      className: "",
      iconSize: [36, 36]
    });
  }
}).addTo(map);

// ── Video Panel ──
const videoPanel = document.getElementById("videoPanel");
const vpOverlay  = document.getElementById("vpOverlay");
const vpClose    = document.getElementById("vpClose");
const vpScheme   = document.getElementById("vpScheme");
const vpDistrict = document.getElementById("vpDistrict");
const vpVideos   = document.getElementById("vpVideos");

function openVideoPanel(entry) {
  vpScheme.textContent      = entry.scheme;
  vpScheme.style.background = categoryColors[entry.scheme] || "#555";
  vpDistrict.textContent    = entry.district;

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

// ── Pin icon ──
function pinIcon(scheme) {
  const color = categoryColors[scheme] || "#555";
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

// ── Render markers ──
function renderVideoMarkers(data) {
  videoMarkerLayer.clearLayers();

  const filtered = currentScheme === "ALL"
    ? data
    : data.filter(d => d.scheme === currentScheme);

  filtered.forEach(entry => {
    const marker = L.marker([entry.lat, entry.lng], { icon: pinIcon(entry.scheme) });
    marker.on("click", () => openVideoPanel(entry));

    const count = (entry.videos || []).length;
    marker.bindPopup(`
      <div style="font-family:'DM Mono',monospace;font-size:11px;min-width:160px;">
        <div style="font-size:14px;font-family:'Playfair Display',serif;font-weight:700;margin-bottom:4px">${entry.district}</div>
        <div style="color:#888;letter-spacing:1px;text-transform:uppercase;font-size:9px;margin-bottom:6px">${entry.scheme}</div>
        <div style="color:#c8401a;font-size:11px;">▶ ${count} video${count !== 1 ? "s" : ""} — click to watch</div>
      </div>
    `, { closeButton: false, maxWidth: 200 });

    marker.on("mouseover", function() { this.openPopup(); });
    marker.on("mouseout",  function() { this.closePopup(); });
    videoMarkerLayer.addLayer(marker);
  });

  updateStats(filtered);
}

function updateStats(filtered) {
  const districts = new Set(filtered.map(d => d.district)).size;
  const videos    = filtered.reduce((s, d) => s + (d.videos || []).length, 0);
  document.getElementById("districtStat").textContent = districts;
  document.getElementById("videoStat").textContent    = videos;
  document.getElementById("videoCount").textContent   =
    `${videos} video${videos !== 1 ? "s" : ""} across ${districts} district${districts !== 1 ? "s" : ""}`;
}

// ── GeoJSON ──
fetch("./data/india_boundary.geojson")
  .then(r => r.json())
  .then(data => {
    const statesMap = {};
    const geojson   = L.geoJSON(data, {
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
            pane: "labels", interactive: false,
            icon: L.divIcon({ className: "district-label", html: district })
          }).addTo(districtLabelLayer);
        }
      }
    }).addTo(map);

    Object.entries(statesMap).forEach(([state, bounds]) => {
      L.marker(bounds.getCenter(), {
        pane: "labels", interactive: false,
        icon: L.divIcon({ className: "state-label", html: state })
      }).addTo(stateLabelLayer);
    });

    map.fitBounds(geojson.getBounds(), { padding: [20, 20], maxZoom: 6 });
    updateLabels();
  })
  .catch(() => map.setView([20.5937, 78.9629], 5));

// ── Load video data ──
fetch("./data/videos.json")
  .then(r => r.json())
  .then(data => {
    allVideoData = data;
    renderVideoMarkers(allVideoData);
    populateCounts(allVideoData);
  })
  .catch(() => {
    document.getElementById("videoCount").textContent = "—";
  });

// ── Populate video counts in dialog ──
function populateCounts(data) {
  const categories = ["ALL", "MDM", "ICDS", "PDS", "NREGA", "Pension", "Aadhaar"];
  categories.forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (!el) return;
    const count = cat === "ALL"
      ? data.reduce((s, d) => s + (d.videos || []).length, 0)
      : data.filter(d => d.scheme === cat).reduce((s, d) => s + (d.videos || []).length, 0);
    el.textContent = `${count} videos`;
  });
}

// ── Label visibility ──
function updateLabels() {
  const z = map.getZoom();
  if (z < 9)  map.addLayer(stateLabelLayer);    else map.removeLayer(stateLabelLayer);
  if (z >= 7) map.addLayer(districtLabelLayer); else map.removeLayer(districtLabelLayer);
}
map.on("zoomend", updateLabels);

// ── Filter Dialog ──
const filterDialog  = document.getElementById("filterDialog");
const filterOverlay = document.getElementById("filterOverlay");
const openBtn       = document.getElementById("openFilterDialog");
const closeBtn      = document.getElementById("closeFilterDialog");
const applyBtn      = document.getElementById("applyFilter");
const activeLabel   = document.getElementById("activeFilterLabel");

function openDialog() {
  filterDialog.classList.remove("hidden");
  filterDialog.classList.add("pop-in");
  filterOverlay.classList.remove("hidden");
  // Sync dialog selection to current active
  document.querySelectorAll(".fd-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.scheme === currentScheme);
  });
  pendingScheme = currentScheme;
}

function closeDialog() {
  filterDialog.classList.add("hidden");
  filterDialog.classList.remove("pop-in");
  filterOverlay.classList.add("hidden");
}

openBtn.addEventListener("click", openDialog);
closeBtn.addEventListener("click", closeDialog);
filterOverlay.addEventListener("click", closeDialog);

document.querySelectorAll(".fd-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".fd-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    pendingScheme = btn.dataset.scheme;
  });
});

applyBtn.addEventListener("click", () => {
  currentScheme = pendingScheme;

  // Update header label
  const names = {
    ALL: "All Categories", MDM: "MDM — Mid-Day Meal",
    ICDS: "ICDS — Child Development", PDS: "PDS — Public Distribution",
    NREGA: "NREGA — Rural Employment",
    Pension: "Pension — Social Security",
    Aadhaar: "Aadhaar — Digital Identity"
  };
  activeLabel.textContent = names[currentScheme] || currentScheme;

  closeDialog();
  closeVideoPanel();
  renderVideoMarkers(allVideoData);
});

// ── Carousel ──
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