(function () {
  "use strict";

  var mapEl = document.getElementById("map");
  var note = document.getElementById("map-note");
  var wardSelect = document.getElementById("map-ward");

  function esc(value) {
    return DaycarePlaces.esc(value);
  }

  if (!window.L || !window.maplibregl || !L.maplibreGL) {
    note.hidden = false;
    note.textContent = "The map library did not load.";
    return;
  }

  var map = L.map(mapEl, { scrollWheelZoom: true, maxZoom: 18 }).setView([56.13, -106.35], 4);
  L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/positron"
  }).addTo(map);

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 48,
    iconCreateFunction: function (group) {
      return L.divIcon({
        html: "<span>" + group.getChildCount() + "</span>",
        className: "cluster-pin",
        iconSize: [36, 36]
      });
    }
  });
  map.addLayer(cluster);
  var markers = [];
  var RATE_HIGH = "#15803d";
  var RATE_MID = "#eab308";
  var RATE_LOW = "#78716c";
  var RATE_NONE = "#dc2626";

  function colorFor(rating) {
    if (rating == null) return RATE_NONE;
    if (rating < 3) return RATE_LOW;
    if (rating >= 4.5) return RATE_HIGH;
    return RATE_MID;
  }

  function bestRating(programs) {
    var rating = null;
    for (var i = 0; i < programs.length; i++) {
      if (programs[i][2] != null && (rating == null || programs[i][2] > rating)) rating = programs[i][2];
    }
    return rating;
  }

  function popup(centre) {
    var programs = (centre.programs || []).map(function (program) { return program[0]; }).join(", ");
    var rating = bestRating(centre.programs || []);
    var ratingText = rating == null ? "No published rating" : "Highest rating " + rating.toFixed(2);
    return '<a href="' + esc(DaycarePlaces.page("centre.html", { id: centre.id })) + '">' + esc(centre.name) + "</a>"
      + "<br>" + esc(centre.address || "Address not published")
      + "<br>" + esc(centre.ward || "")
      + "<br>" + esc(ratingText)
      + (programs ? "<br>" + esc(programs) : "");
  }

  function show(ward) {
    cluster.clearLayers();
    var visible = [];
    for (var i = 0; i < markers.length; i++) {
      if (!ward || markers[i].ward === ward) visible.push(markers[i].marker);
    }
    cluster.addLayers(visible);
    if (!visible.length) return;
    var group = L.featureGroup(visible);
    map.fitBounds(group.getBounds().pad(0.08), { maxZoom: ward ? 14 : 12 });
  }

  DaycarePlaces.ready
    .then(function () {
      return fetch(DaycarePlaces.fileUrl("catalog.json"));
    })
    .then(function (response) {
      if (!response.ok) throw new Error("catalog");
      return response.json();
    })
    .then(function (catalog) {
      var meta = catalog.meta || {};
      var place = catalog.place || {};
      var lede = document.getElementById("map-lede");
      if (lede && meta.mapLede) lede.textContent = meta.mapLede;
      DaycarePlaces.paintFooter(meta);
      var areaLabel = place.areaLabel || "Area";
      var label = document.getElementById("map-area-label");
      if (label) label.textContent = areaLabel;
      var options = '<option value="">All ' + esc((place.areaLabelPlural || "areas").toLowerCase()) + "</option>";
      (catalog.wards || []).forEach(function (ward) {
        options += '<option value="' + esc(ward.name) + '">' + esc(ward.name) + " (" + ward.count + ")</option>";
      });
      wardSelect.innerHTML = options;
      if (place.map && place.map.lat != null && place.map.lon != null) {
        map.setView([place.map.lat, place.map.lon], place.map.zoom || 11);
      }
      var placed = 0;
      catalog.centres.forEach(function (centre) {
        if (centre.lat == null || centre.lon == null) return;
        var rating = bestRating(centre.programs || []);
        var marker = L.circleMarker([centre.lat, centre.lon], {
          radius: 8,
          color: "#292524",
          weight: 1.5,
          fillColor: colorFor(rating),
          fillOpacity: 0.96
        });
        marker.bindPopup(popup(centre));
        markers.push({ ward: centre.ward, marker: marker });
        placed += 1;
      });
      note.textContent = placed.toLocaleString("en-CA") + " centres with an address point. " + (catalog.centres.length - placed) + " are not on the map.";
      show(wardSelect.value);
      wardSelect.addEventListener("change", function () { show(wardSelect.value); });
    })
    .catch(function () {
      note.hidden = false;
      note.textContent = "The centre list did not load.";
    });
})();
