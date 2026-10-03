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

  function icon(name, extraClass) {
    var stroke = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var bodies = {
      pin: '<path ' + stroke + ' d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle ' + stroke + ' cx="12" cy="11" r="2.1"/>',
      star: '<path fill="currentColor" d="M12 3.1 14.3 7.8l5.2.8-3.8 3.6.9 5.1L12 15l-4.6 2.3.9-5.1-3.8-3.6 5.2-.8z"/>',
      phone: '<path ' + stroke + ' d="M7.2 4.6h2l1 2.5-1.3.8a10.2 10.2 0 0 0 5.1 5.1l.8-1.3 2.5 1v2A1.5 1.5 0 0 1 15.8 17 13.2 13.2 0 0 1 5.6 6.1a1.5 1.5 0 0 1 1.6-1.5z"/>',
      check: '<path ' + stroke + ' d="M5 12.4 9.2 16.6 19 7"/>',
      building: '<path ' + stroke + ' d="M5 20V6.6A1.4 1.4 0 0 1 6.4 5.2h6.2A1.4 1.4 0 0 1 14 6.6V20"/><path ' + stroke + ' d="M14 10.2h3.4A1.4 1.4 0 0 1 18.8 11.6V20H5"/><path ' + stroke + ' d="M8 8.4h2M8 11.8h2M8 15.2h2"/>',
      heart: '<path ' + stroke + ' d="M12 19.2s-6.2-3.8-6.2-7.7A3.5 3.5 0 0 1 12 8.8a3.5 3.5 0 0 1 6.2 2.7c0 3.9-6.2 7.7-6.2 7.7z"/>',
      hands: '<path ' + stroke + ' d="M8.2 11.2V7.4a1.35 1.35 0 0 1 2.7 0v3.8"/><path ' + stroke + ' d="M10.9 10.4V6.4a1.35 1.35 0 0 1 2.7 0v4.4"/><path ' + stroke + ' d="M13.6 10.6V8.1a1.35 1.35 0 0 1 2.7 0v5.2c0 2.9-2.1 5.2-5 5.2h-1.1c-1.3 0-2.5-.6-3.3-1.5L3.8 13.2a1.45 1.45 0 0 1 2.1-2l2.3 2"/>',
      leaf: '<path ' + stroke + ' d="M5.2 18.8s1-7 7.2-10.4C17 6.2 19.8 4.8 19.8 4.8s-.4 6-4.2 9.8-10.4 4.2-10.4 4.2z"/><path ' + stroke + ' d="M8.2 16.4c2-1.3 3.8-3 5-5.2"/>',
      infant: '<circle ' + stroke + ' cx="12" cy="9.2" r="3"/><path ' + stroke + ' d="M10.1 7.4c.5-1.3 1.3-1.8 2.4-1.5"/><path ' + stroke + ' d="M8.4 20.2c.5-3.6 1.9-5.6 3.6-5.6s3.1 2 3.6 5.6"/>',
      toddler: '<circle ' + stroke + ' cx="12" cy="5.5" r="2.2"/><path ' + stroke + ' d="M12 7.8v5"/><path ' + stroke + ' d="M8 10.2h8"/><path ' + stroke + ' d="M12 12.8 9.4 19.8M12 12.8l2.6 7"/>',
      preschool: '<circle ' + stroke + ' cx="8.2" cy="8" r="2.2"/><rect ' + stroke + ' x="4" y="13" width="6.2" height="6.2" rx="1"/><path ' + stroke + ' d="M13.2 19.2h6.6L16.5 12.2z"/>',
      kindergarten: '<path ' + stroke + ' d="M12 9.6c-3.1.2-5.2 2.3-5.2 5 0 2.7 2.2 5 5.2 5.4 3-.4 5.2-2.7 5.2-5.4 0-2.7-2.1-4.8-5.2-5z"/><path ' + stroke + ' d="M12 9.6V5.4"/><path ' + stroke + ' d="M12 6.6c1.8-.3 3 .7 3.4 1.8-1.6.3-2.7-.2-3.4-1.8z"/>',
      grades: '<path ' + stroke + ' d="M12 7.6c-2.2-1.2-4.6-1.5-7.2-.8v11.2c2.6-.7 5-.4 7.2.8 2.2-1.2 4.6-1.5 7.2-.8V6.8c-2.6-.7-5-.4-7.2.8z"/><path ' + stroke + ' d="M12 7.6v11.2"/>',
      school: '<path ' + stroke + ' d="M9 8.2V7a3 3 0 0 1 6 0v1.2"/><rect ' + stroke + ' x="6.4" y="8.2" width="11.2" height="10.6" rx="2"/><path ' + stroke + ' d="M9.2 13h5.6"/>',
      ages: '<circle ' + stroke + ' cx="8" cy="9" r="2"/><circle ' + stroke + ' cx="16" cy="9" r="2"/><path ' + stroke + ' d="M4.8 18.2c.4-2.4 1.6-3.6 3.2-3.6s2.8 1.2 3.2 3.6M12.8 18.2c.4-2.4 1.6-3.6 3.2-3.6s2.8 1.2 3.2 3.6"/>',
      open: '<path ' + stroke + ' d="M8 16 16 8M10 8h6v6"/>'
    };
    var cls = "ico" + (extraClass ? " " + extraClass : "");
    return '<svg class="' + cls + '" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">' + (bodies[name] || bodies.ages) + "</svg>";
  }

  function programIconKey(name) {
    var keys = {
      "Infant": "infant",
      "Toddler": "toddler",
      "Preschool": "preschool",
      "Kindergarten": "kindergarten",
      "Kindergarten to Grade 5/6": "grades",
      "School age": "school"
    };
    return keys[name] || "ages";
  }

  function programIcon(name) {
    return icon(programIconKey(name));
  }

  function formatScore(value) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function starsHtml(value) {
    var n = Number(value);
    var html = '<span class="stars" aria-hidden="true">';
    for (var i = 0; i < 5; i++) {
      var fill = n - i;
      var state = fill >= 0.75 ? "full" : fill >= 0.25 ? "half" : "empty";
      if (state === "half") {
        html += '<span class="star half">' + icon("star", "star-base") + icon("star", "star-fill") + "</span>";
      } else {
        html += '<span class="star ' + state + '">' + icon("star") + "</span>";
      }
    }
    return html + "</span>";
  }

  function phoneLayout() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  var suppressScrollHide = false;
  var ageTip = document.createElement("div");
  ageTip.className = "age-tip";
  ageTip.setAttribute("role", "tooltip");
  ageTip.setAttribute("aria-hidden", "true");
  ageTip.hidden = true;
  document.body.appendChild(ageTip);

  function hideAgeTip() {
    ageTip.hidden = true;
    ageTip.textContent = "";
    var open = document.querySelectorAll(".is-tip");
    for (var i = 0; i < open.length; i++) open[i].classList.remove("is-tip");
  }

  function placeAgeTip(anchor) {
    var rect = anchor.getBoundingClientRect();
    var tipRect = ageTip.getBoundingClientRect();
    var left = rect.left + rect.width / 2;
    var half = tipRect.width / 2;
    left = Math.max(8 + half, Math.min(left, window.innerWidth - 8 - half));
    if (anchor.classList.contains("prog") && anchor.parentElement) {
      var icons = anchor.parentElement.querySelectorAll(".prog");
      var last = icons.length ? icons[icons.length - 1].getBoundingClientRect() : rect;
      var sideLeft = last.right + 8;
      if (sideLeft + tipRect.width <= window.innerWidth - 8) {
        ageTip.style.left = sideLeft + "px";
        ageTip.style.top = (rect.top + rect.height / 2) + "px";
        ageTip.style.transform = "translate(0, -50%)";
        return;
      }
    }
    var belowTop = rect.bottom + 8;
    var aboveTop = rect.top - 8;
    var fitsBelow = belowTop + tipRect.height <= window.innerHeight - 8;
    var fitsAbove = aboveTop - tipRect.height >= 8;
    var below = anchor.classList.contains("prog") ? (fitsBelow || !fitsAbove) : !fitsAbove;
    ageTip.style.left = left + "px";
    if (below) {
      ageTip.style.top = belowTop + "px";
      ageTip.style.transform = "translate(-50%, 0)";
    } else {
      ageTip.style.top = aboveTop + "px";
      ageTip.style.transform = "translate(-50%, -100%)";
    }
  }

  function showAgeTip(anchor) {
    var text = anchor.getAttribute("data-tip") || "";
    if (!text) return;
    hideAgeTip();
    if (anchor.classList.contains("prog")) {
      var rect = anchor.getBoundingClientRect();
      var overflow = rect.bottom + 48 - (window.innerHeight - 8);
      if (overflow > 0) {
        suppressScrollHide = true;
        window.scrollBy(0, overflow);
        window.setTimeout(function () { suppressScrollHide = false; }, 120);
      }
    }
    anchor.classList.add("is-tip");
    ageTip.textContent = text;
    ageTip.hidden = false;
    placeAgeTip(anchor);
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target.closest(".prog, .chip-age");
    if (!phoneLayout() || !anchor || !anchor.getAttribute("data-tip")) {
      hideAgeTip();
      return;
    }
    if (anchor.classList.contains("is-tip")) hideAgeTip();
    else showAgeTip(anchor);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideAgeTip();
  });
  window.addEventListener("resize", hideAgeTip);
  window.addEventListener("scroll", function () {
    if (!suppressScrollHide) hideAgeTip();
  }, true);

  function mapsHref(spec) {
    var lat = Number(spec.lat);
    var lon = Number(spec.lon);
    var query = "";
    if (spec.lat != null && spec.lon != null && spec.lat !== "" && spec.lon !== "" && isFinite(lat) && isFinite(lon)) {
      query = lat + "," + lon;
    } else if (spec.address && spec.address !== "Address not published") {
      var placeName = city && city.name ? city.name : "";
      query = spec.address + (placeName ? ", " + placeName : "");
    }
    if (!query) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function centreCard(spec) {
    var rating = "";
    if (spec.rating != null && spec.rating !== "") {
      var low = Number(spec.rating) < 3;
      var scoreText = formatScore(spec.rating);
      var label = spec.ratingLabel || "Highest rating";
      rating = '<p class="rating-pill' + (low ? " low" : "") + '" aria-label="' + esc(label) + " " + esc(scoreText) + ' out of 5">'
        + starsHtml(spec.rating) + "<b>" + esc(scoreText) + "</b></p>";
    }
    var programs = spec.programs || [];
    var progHtml = "";
    if (!programs.length) {
      progHtml = '<p class="prog-empty">No program published</p>';
    } else {
      var parts = [];
      for (var i = 0; i < programs.length; i++) {
        var program = programs[i];
        var name = program[0] || "Program";
        var shown = name === "Kindergarten to Grade 5/6" ? "K\u2013Gr 5/6" : name;
        var score = program[2];
        var isLow = score != null && Number(score) < 3;
        var programScore = score == null ? "" : formatScore(score);
        var tip = programScore ? name + " · " + programScore : name;
        var mark = programScore ? '<b class="' + (isLow ? "low" : "ok") + '">' + esc(programScore) + "</b>" : "";
        parts.push('<button type="button" class="prog' + (isLow ? " low" : "") + '" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">'
          + programIcon(name) + '<span class="prog-label">' + esc(shown) + "</span>" + mark + "</button>");
      }
      progHtml = '<div class="progs">' + parts.join("") + "</div>";
    }
    var distance = "";
    if (spec.showDistance) {
      distance = spec.distance
        ? '<span class="dist">' + icon("pin") + "<span>" + esc(spec.distance) + "</span></span>"
        : '<span class="dist muted">' + icon("pin") + "<span>No map point</span></span>";
    }
    var vacancy = "";
    if (spec.vacancy) {
      var kind = String(spec.vacancy).toLowerCase();
      var label = spec.vacancy === "Yes" ? "Vacancies available" : spec.vacancy === "No" ? "No Vacancy" : "Vacancy unknown";
      vacancy = '<span class="badge ' + esc(kind) + '">' + (spec.vacancy === "Yes" ? icon("check") : "") + esc(label) + "</span>";
    }
    var phone = spec.phone
      ? '<a class="phone" href="' + esc(telHref(spec.phone)) + '">' + icon("phone") + "<span>" + esc(spec.phone) + "</span></a>"
      : "";
    var status = (distance || vacancy || phone)
      ? '<div class="card-status">' + distance + vacancy + phone + "</div>"
      : "";
    function meta(iconName, html) {
      return html ? "<li>" + icon(iconName) + html + "</li>" : "";
    }
    var ward = "";
    if (spec.ward) {
      ward = spec.wardHref
        ? '<a href="' + esc(spec.wardHref) + '">' + esc(spec.ward) + "</a>"
        : esc(spec.ward);
    }
    var bits = meta("building", ward)
      + meta("heart", spec.auspice ? esc(spec.auspice) : "")
      + meta("hands", spec.fee ? esc(spec.fee) : "")
      + meta("leaf", spec.cwelcc ? esc(spec.cwelcc) : "");
    var note = spec.note ? '<p class="close-tag">' + esc(spec.note) + "</p>" : "";
    var addrText = spec.address || "Address not published";
    var maps = mapsHref(spec);
    var addrInner = icon("pin") + "<span>" + esc(addrText) + "</span>";
    var addrHtml = maps
      ? '<a class="addr" href="' + esc(maps) + '" target="_blank" rel="noopener noreferrer">' + addrInner + '<span class="vh">opens in Google Maps</span></a>'
      : '<p class="addr">' + addrInner + "</p>";
    return '<article class="card"><h2><a href="' + esc(spec.href) + '" target="_blank" rel="noopener noreferrer">'
      + esc(spec.name) + "\u00a0" + icon("open", "ext") + '<span class="vh">opens in a new tab</span></a></h2>'
      + addrHtml
      + rating
      + progHtml
      + note
      + status
      + (bits ? '<ul class="card-meta">' + bits + "</ul>" : "")
      + "</article>";
  }

  return {
    ready: ready,
    path: function () { return path; },
    city: function () { return city; },
    page: page,
    fileUrl: fileUrl,
    esc: esc,
    telHref: telHref,
    paintFooter: paintFooter,
    centreCard: centreCard,
    programIcon: programIcon
  };
})();
