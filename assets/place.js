window.DaycarePlaces = (function () {
  "use strict";

  var STORAGE = "daycare-place";
  var MEMORY = "daycare-place-by-province";
  var places = null;
  var path = "";
  var city = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function telHref(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "tel:+1" + digits;
    if (digits.length === 11 && digits.charAt(0) === "1") return "tel:+" + digits;
    return digits ? "tel:" + digits : "";
  }

  function provinceList() {
    return (places && places.provinces) || [];
  }

  function eachCity(visit) {
    var provinces = provinceList();
    for (var i = 0; i < provinces.length; i++) {
      var cities = provinces[i].cities || [];
      for (var j = 0; j < cities.length; j++) visit(provinces[i], cities[j]);
    }
  }

  function find(next) {
    var found = null;
    eachCity(function (province, item) {
      if (item.path === next) found = { province: province, city: item };
    });
    return found;
  }

  function byName(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "en");
  }

  function citiesIn(code) {
    var provinces = provinceList();
    for (var i = 0; i < provinces.length; i++) {
      if (provinces[i].code === code) return (provinces[i].cities || []).slice().sort(byName);
    }
    return [];
  }

  function readMemory() {
    try {
      var raw = localStorage.getItem(MEMORY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      return {};
    }
  }

  function remember(next) {
    var found = find(next);
    if (!found) return;
    try {
      localStorage.setItem(STORAGE, next);
      var memory = readMemory();
      memory[found.province.code] = next;
      localStorage.setItem(MEMORY, JSON.stringify(memory));
    } catch (error) {}
  }

  function page(file, extra) {
    var params = new URLSearchParams();
    params.set("place", path);
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        if (extra[key] != null && String(extra[key]) !== "") params.set(key, extra[key]);
      });
    }
    return file + "?" + params.toString();
  }

  function fileUrl(name) {
    return "data/" + path + "/" + name;
  }

  function pageFile() {
    var current = document.body.getAttribute("data-page");
    if (current === "map") return "map.html";
    if (current === "areas") return "areas.html";
    if (current === "programs") return "programs.html";
    if (current === "about") return "about.html";
    return "index.html";
  }

  function go(next) {
    if (!find(next) || next === path) return;
    remember(next);
    location.href = pageFile() + "?place=" + encodeURIComponent(next);
  }

  function provinceName(code) {
    var provinces = provinceList();
    for (var i = 0; i < provinces.length; i++) {
      if (provinces[i].code === code) return provinces[i].name || String(code).toUpperCase();
    }
    return String(code || "").toUpperCase();
  }

  function showChoice(kind, multiple) {
    var label = document.getElementById(kind + "-label");
    var field = document.querySelector(".place-field." + kind);
    if (label) label.hidden = !!multiple;
    if (field) field.hidden = !multiple;
  }

  function fillCities(code, selected) {
    var citySelect = document.getElementById("city-select");
    var label = document.getElementById("city-label");
    var options = citiesIn(code);
    var name = "";
    var html = "";
    for (var i = 0; i < options.length; i++) {
      if (!name || options[i].path === selected) name = options[i].name;
      html += '<option value="' + esc(options[i].path) + '">' + esc(options[i].name) + "</option>";
    }
    if (!name && city) name = city.name;
    if (label) label.textContent = name;
    showChoice("city", options.length > 1);
    if (!citySelect) return;
    citySelect.innerHTML = html || "<option>No city</option>";
    if (selected) citySelect.value = selected;
    citySelect.disabled = options.length === 0;
  }

  function fillPlaceControls() {
    var provinceSelect = document.getElementById("province-select");
    var citySelect = document.getElementById("city-select");
    var provinceLabel = document.getElementById("province-label");
    if (!city) return;
    var provinces = provinceList().slice().sort(byName);
    var html = "";
    for (var i = 0; i < provinces.length; i++) {
      var code = provinces[i].code;
      html += '<option value="' + esc(code) + '" title="' + esc(provinces[i].name) + '">' + esc(String(code).toUpperCase()) + "</option>";
    }
    if (provinceLabel) provinceLabel.textContent = provinceName(city.province);
    showChoice("province", provinces.length > 1);
    if (provinceSelect) {
      provinceSelect.innerHTML = html;
      provinceSelect.value = city.province;
      provinceSelect.title = provinceName(city.province);
      provinceSelect.setAttribute("aria-label", "Province, " + provinceName(city.province));
      provinceSelect.onchange = function () {
        var nextCode = provinceSelect.value;
        var options = citiesIn(nextCode);
        if (!options.length) return;
        var remembered = readMemory()[nextCode] || "";
        var next = "";
        for (var n = 0; n < options.length; n++) {
          if (options[n].path === remembered) next = remembered;
        }
        if (!next && places.default) {
          var preferred = find(places.default);
          if (preferred && preferred.province.code === nextCode) next = places.default;
        }
        if (!next) next = options[0].path;
        fillCities(nextCode, next);
        go(next);
      };
    }
    fillCities(city.province, path);
    if (citySelect) {
      citySelect.onchange = function () {
        go(citySelect.value);
      };
    }
  }

  function paint() {
    var brandLink = document.getElementById("brand-link");
    if (brandLink) brandLink.href = page("index.html");
    fillPlaceControls();

    var currentPage = document.body.getAttribute("data-page");
    var links = document.querySelectorAll("nav.site a[data-nav]");
    for (var n = 0; n < links.length; n++) {
      var link = links[n];
      var nav = link.getAttribute("data-nav");
      var target = "index.html";
      if (nav === "map") target = "map.html";
      else if (nav === "areas") target = "areas.html";
      else if (nav === "programs") target = "programs.html";
      else if (nav === "about") target = "about.html";
      link.href = page(target);
      if (nav === currentPage) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function paintFooter(meta) {
    var metaEl = document.getElementById("foot-meta");
    var sampleEl = document.getElementById("foot-sample");
    var noteEl = document.getElementById("site-footer");
    if (!city) return;
    if (metaEl) {
      var parts = [city.name + ", " + city.provinceName];
      var updated = (meta && meta.retrievedLabel) || city.updatedLabel;
      if (updated) parts.push("Last updated " + updated);
      if (meta && meta.sourceName) parts.push(meta.sourceName);
      metaEl.textContent = parts.join(" · ");
    }
    if (sampleEl) sampleEl.hidden = !city.sample;
    if (noteEl && meta && meta.footer) noteEl.textContent = meta.footer;
  }

  function choose() {
    var params = new URLSearchParams(location.search);
    var requested = params.get("place") || "";
    var saved = "";
    try { saved = localStorage.getItem(STORAGE) || ""; } catch (error) {}
    var picked = find(requested) || find(saved) || find(places.default);
    if (!picked) {
      eachCity(function (province, item) {
        if (!picked) picked = { province: province, city: item };
      });
    }
    if (!picked) throw new Error("places");
    path = picked.city.path;
    city = {
      id: picked.city.id,
      name: picked.city.name,
      path: picked.city.path,
      province: picked.province.code,
      provinceName: picked.province.name,
      areaLabel: picked.city.areaLabel || "Area",
      areaLabelPlural: picked.city.areaLabelPlural || "Areas",
      updatedLabel: picked.city.updatedLabel || "",
      sample: !!picked.city.sample
    };
    remember(path);
    if (params.get("place") !== path) {
      params.set("place", path);
      history.replaceState(null, "", location.pathname + "?" + params.toString());
    }
    paint();
    paintFooter();
  }

  var ready = fetch("data/places.json")
    .then(function (response) {
      if (!response.ok) throw new Error("places");
      return response.json();
    })
    .then(function (data) {
      if (!data || data.country !== "CA" || !data.provinces) throw new Error("places");
      places = data;
      choose();
      return city;
    });

  ready.catch(function () {
    ["province", "city"].forEach(function (kind) {
      var label = document.getElementById(kind + "-label");
      var field = document.querySelector(".place-field." + kind);
      var select = document.getElementById(kind + "-select");
      if (label) {
        label.hidden = false;
        label.textContent = "Unavailable";
      }
      if (field) field.hidden = true;
      if (select) {
        select.innerHTML = "<option>List unavailable</option>";
        select.disabled = true;
      }
    });
  });

  return {
    ready: ready,
    path: function () { return path; },
    city: function () { return city; },
    page: page,
    fileUrl: fileUrl,
    esc: esc,
    telHref: telHref,
    paintFooter: paintFooter
  };
})();
