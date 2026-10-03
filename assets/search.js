(function () {
  "use strict";

  var SHOWN_STEP = 40;
  var DEFAULT_SORT = "rating";
  var form = document.getElementById("search-form");
  var listEl = document.getElementById("list");
  var countEl = document.getElementById("count");
  var moreBtn = document.getElementById("more");
  var emptyEl = document.getElementById("empty");
  var noteEl = document.getElementById("distance-note");
  var clearBtn = document.getElementById("clear-search");
  var qInput = document.getElementById("q");

  var catalog = null;
  var entries = [];
  var postals = null;
  var areas = null;
  var postalTask = null;
  var origin = null;
  var distanceKey = null;
  var postalStatus = "";
  var shown = SHOWN_STEP;
  var timer = 0;

  function esc(value) {
    return DaycarePlaces.esc(value);
  }

  function wordsOf(text) {
    var out = [];
    var seen = Object.create(null);
    var parts = text ? text.split(" ") : [];
    for (var i = 0; i < parts.length; i++) {
      var word = parts[i];
      if (word.length < 2 || seen[word]) continue;
      seen[word] = 1;
      out.push(word);
    }
    return out;
  }

  function labelize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function compactPostal(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function postalShape(code) {
    if (!code) return "";
    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) return "point";
    if (/^[A-Z]\d[A-Z]$/.test(code)) return "area";
    if (/^[A-Z](\d([A-Z](\d([A-Z](\d)?)?)?)?)?$/.test(code)) return "partial";
    return "invalid";
  }

  function read() {
    var data = new FormData(form);
    return {
      q: String(data.get("q") || "").slice(0, 80),
      postal: compactPostal(data.get("postal") || ""),
      km: String(data.get("km") || ""),
      sort: String(data.get("sort") || DEFAULT_SORT),
      ward: String(data.get("ward") || ""),
      program: String(data.get("program") || ""),
      vacancy: String(data.get("vacancy") || ""),
      minRating: String(data.get("min") || ""),
      auspice: String(data.get("auspice") || ""),
      fee: String(data.get("fee") || ""),
      cwelcc: String(data.get("cwelcc") || ""),
      language: String(data.get("lang") || ""),
      website: data.get("web") === "1"
    };
  }

  function writeUrl(state) {
    var params = new URLSearchParams();
    params.set("place", DaycarePlaces.path());
    if (state.q) params.set("q", state.q);
    if (state.postal) params.set("postal", state.postal);
    if (state.km) params.set("km", state.km);
    if (state.sort && state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
    if (state.ward) params.set("ward", state.ward);
    if (state.program) params.set("program", state.program);
    if (state.vacancy) params.set("vacancy", state.vacancy);
    if (state.minRating) params.set("min", state.minRating);
    if (state.auspice) params.set("auspice", state.auspice);
    if (state.fee) params.set("fee", state.fee);
    if (state.cwelcc) params.set("cwelcc", state.cwelcc);
    if (state.language) params.set("lang", state.language);
    if (state.website) params.set("web", "1");
    history.replaceState(null, "", "?" + params.toString());
  }

  function setSelect(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    var found = false;
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === value) found = true;
    }
    el.value = found ? value : "";
  }

  function optionList(pairs) {
    return pairs.map(function (pair) {
      return '<option value="' + esc(pair[0]) + '">' + esc(pair[1]) + "</option>";
    }).join("");
  }

  function fillFilters() {
    var params = new URLSearchParams(location.search);
    var areaLabel = catalog.place.areaLabel || "Area";
    document.getElementById("area-label").textContent = areaLabel;
    var sortArea = document.querySelector('#sort option[value="ward"]');
    if (sortArea) sortArea.textContent = areaLabel;
    var labels = catalog.labels || {};
    document.getElementById("ward").innerHTML = optionList(
      [["", "Any " + areaLabel.toLowerCase()]].concat((catalog.wards || []).map(function (ward) {
        return [ward.name, ward.name];
      }))
    );
    document.getElementById("program").innerHTML = optionList(
      [["", "Any program"]].concat((catalog.programNames || []).map(function (name) {
        return [name, name];
      }))
    );
    document.getElementById("vacancy").innerHTML = optionList(
      [["", "Any vacancy"]].concat((catalog.vacancies || []).map(function (name) {
        return [name, name];
      }))
    );
    document.getElementById("auspice").innerHTML = optionList(
      [["", "Any operator"], ["__none__", "Not stated on the centre page"]].concat((catalog.auspices || []).map(function (name) {
        return [name, (labels.auspices && labels.auspices[name]) || labelize(name)];
      }))
    );
    document.getElementById("fee").innerHTML = optionList(
      [["", "Any fee subsidy"]].concat((catalog.fees || []).map(function (name) {
        return [name, (labels.fees && labels.fees[name]) || name];
      }))
    );
    document.getElementById("cwelcc").innerHTML = optionList(
      [["", "Any CWELCC status"]].concat((catalog.cwelccValues || []).map(function (name) {
        return [name, (labels.cwelcc && labels.cwelcc[name]) || name];
      }))
    );
    document.getElementById("lang").innerHTML = optionList(
      [["", "Any language"]].concat((catalog.languages || []).map(function (name) {
        return [name, name];
      }))
    );
    var known = Object.create(null);
    (catalog.programNames || []).forEach(function (name) { known[name] = 1; });
    document.querySelectorAll("[data-chip]").forEach(function (button) {
      var id = button.getAttribute("data-chip");
      if (id === "vacancy" || id === "rated" || id === "near") return;
      button.hidden = !known[id];
    });
    qInput.value = params.get("q") || "";
    document.getElementById("postal").value = DaycareFuzzy.formatPostal(compactPostal(params.get("postal") || ""));
    setSelect("km", params.get("km") || "");
    setSelect("sort", params.get("sort") || DEFAULT_SORT);
    setSelect("ward", params.get("ward") || "");
    setSelect("program", params.get("program") || "");
    setSelect("vacancy", params.get("vacancy") || "");
    setSelect("min", params.get("min") || "");
    setSelect("auspice", params.get("auspice") || "");
    setSelect("fee", params.get("fee") || "");
    setSelect("cwelcc", params.get("cwelcc") || "");
    setSelect("lang", params.get("lang") || "");
    document.getElementById("web").checked = params.get("web") === "1";
  }

  function paintIntro() {
    var meta = catalog.meta || {};
    document.getElementById("page-lede").textContent = meta.lede || "";
    document.getElementById("vacancy-hint").textContent = meta.vacancyHint || "";
    document.getElementById("postal-hint").textContent = meta.postalHint || "";
    DaycarePlaces.paintFooter(meta);
    document.getElementById("stats").innerHTML = [
      [catalog.centreCount, "licensed centres"],
      [catalog.ratedCount, "with a published rating"],
      [catalog.vacancyCount, "with a vacancy marked Yes"],
      [catalog.wardCount, meta.statArea || "area names on the published pages"]
    ].map(function (item) {
      return "<li><b>" + Number(item[0] || 0).toLocaleString("en-CA") + "</b><span>" + esc(item[1]) + "</span></li>";
    }).join("");
  }

  function loadPostals() {
    if (postals) return Promise.resolve(postals);
    if (!postalTask) {
      postalTask = fetch(DaycarePlaces.fileUrl("postals.json"))
        .then(function (response) {
          if (!response.ok) throw new Error("postal");
          return response.json();
        })
        .then(function (data) {
          postals = data;
          areas = Object.create(null);
          var codes = Object.keys(data);
          for (var i = 0; i < codes.length; i++) {
            var code = codes[i];
            var fsa = code.slice(0, 3);
            var area = areas[fsa];
            var point = data[code];
            if (!area) {
              area = areas[fsa] = {
                points: [],
                minLat: point[0],
                maxLat: point[0],
                minLon: point[1],
                maxLon: point[1]
              };
            }
            area.points.push(point);
            if (point[0] < area.minLat) area.minLat = point[0];
            if (point[0] > area.maxLat) area.maxLat = point[0];
            if (point[1] < area.minLon) area.minLon = point[1];
            if (point[1] > area.maxLon) area.maxLon = point[1];
          }
          return data;
        });
    }
    return postalTask;
  }

  function resolveOrigin(state) {
    origin = null;
    var shape = postalShape(state.postal);
    if (!shape) {
      postalStatus = "";
      return Promise.resolve();
    }
    if (shape === "invalid") {
      postalStatus = "invalid";
      return Promise.resolve();
    }
    if (shape === "partial") {
      postalStatus = "partial";
      return Promise.resolve();
    }
    postalStatus = "loading";
    return loadPostals().then(function () {
      if (shape === "point") {
        var point = postals[state.postal];
        if (!point) {
          origin = null;
          postalStatus = areas[state.postal.slice(0, 3)] ? "missing-point" : "missing";
          return;
        }
        origin = {
          kind: "point",
          key: "point:" + state.postal,
          lat: point[0],
          lon: point[1],
          label: DaycareFuzzy.formatPostal(state.postal)
        };
        postalStatus = "ok";
        return;
      }
      var area = areas[state.postal];
      if (!area) {
        origin = null;
        postalStatus = "missing";
        return;
      }
      origin = { kind: "area", key: "area:" + state.postal, area: area, label: state.postal };
      postalStatus = "ok";
    }).catch(function () {
      origin = null;
      postalStatus = "error";
    });
  }

  function distanceToOrigin(lat, lon) {
    if (origin.kind === "point") return DaycareFuzzy.haversineKm(origin.lat, origin.lon, lat, lon);
    var points = origin.area.points;
    var best = Infinity;
    var cos = Math.cos(lat * Math.PI / 180);
    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      var x = (point[1] - lon) * cos;
      var y = point[0] - lat;
      var score = x * x + y * y;
      if (score < best) best = score;
    }
    var slack = 2 * Math.sqrt(best) * 0.002 + 0.000004;
    var exact = Infinity;
    for (var j = 0; j < points.length; j++) {
      var candidate = points[j];
      var dx = (candidate[1] - lon) * cos;
      var dy = candidate[0] - lat;
      if (dx * dx + dy * dy > best + slack) continue;
      var kilometres = DaycareFuzzy.haversineKm(candidate[0], candidate[1], lat, lon);
      if (kilometres < exact) exact = kilometres;
    }
    return exact;
  }

  function assignDistances() {
    var key = origin ? origin.key : "";
    if (key === distanceKey) return;
    distanceKey = key;
    for (var i = 0; i < entries.length; i++) {
      var centre = entries[i].centre;
      entries[i].distance = origin && centre.lat != null && centre.lon != null
        ? distanceToOrigin(centre.lat, centre.lon)
        : null;
    }
  }

  function passes(centre, state) {
    if (state.ward && centre.ward !== state.ward) return false;
    if (state.auspice === "__none__") {
      if (centre.auspice) return false;
    } else if (state.auspice && centre.auspice !== state.auspice) return false;
    if (state.fee && centre.fee !== state.fee) return false;
    if (state.cwelcc && centre.cwelcc !== state.cwelcc) return false;
    if (state.language) {
      var spoken = centre.languages || [];
      if (spoken.indexOf(state.language) === -1) return false;
    }
    if (state.website && !centre.web) return false;
    if (state.program || state.vacancy || state.minRating) {
      var minimum = state.minRating ? Number(state.minRating) : null;
      var programs = centre.programs || [];
      var found = false;
      for (var i = 0; i < programs.length; i++) {
        var program = programs[i];
        if (state.program && program[0] !== state.program) continue;
        if (state.vacancy && program[1] !== state.vacancy) continue;
        if (minimum != null && (program[2] == null || program[2] < minimum)) continue;
        found = true;
        break;
      }
      if (!found) return false;
    }
    return true;
  }

  function summarize(centre, state) {
    var programs = centre.programs || [];
    if (state.program) {
      programs = programs.filter(function (program) { return program[0] === state.program; });
    }
    var rating = null;
    var vacancy = "";
    var vrank = 3;
    var ranks = { Yes: 0, Unknown: 1, No: 2 };
    for (var i = 0; i < programs.length; i++) {
      var program = programs[i];
      if (program[2] != null && (rating == null || program[2] > rating)) rating = program[2];
      var rank = ranks[program[1]];
      if (rank != null && rank < vrank) {
        vrank = rank;
        vacancy = program[1];
      }
    }
    return { programs: programs, rating: rating, vacancy: vacancy, vrank: vrank };
  }

  function collect(state) {
    assignDistances();
    var tokens = DaycareFuzzy.tokenize(state.q);
    var radius = state.km && origin ? Number(state.km) : 0;
    var rows = [];
    var excluded = 0;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!passes(entry.centre, state)) continue;
      var score = tokens.length ? DaycareFuzzy.scoreEntry(entry, tokens) : 1;
      if (!score) continue;
      if (radius) {
        if (entry.distance == null) {
          excluded += 1;
          continue;
        }
        if (entry.distance > radius) continue;
      }
      var fuzzy = false;
      for (var t = 0; t < tokens.length; t++) {
        if (DaycareFuzzy.tokenIsFuzzy(tokens[t], entry)) fuzzy = true;
      }
      rows.push({ entry: entry, score: score, fuzzy: fuzzy, summary: summarize(entry.centre, state) });
    }
    rows.sort(function (a, b) {
      if (state.sort === "relevance" && tokens.length && a.score !== b.score) return b.score - a.score;
      if (state.sort === "ward") {
        var wardCmp = String(a.entry.centre.ward || "").localeCompare(String(b.entry.centre.ward || ""), undefined, { sensitivity: "base" });
        if (wardCmp) return wardCmp;
      } else if (state.sort === "rating") {
        if (a.summary.rating == null && b.summary.rating != null) return 1;
        if (b.summary.rating == null && a.summary.rating != null) return -1;
        if (a.summary.rating != null && b.summary.rating != null && a.summary.rating !== b.summary.rating) {
          return b.summary.rating - a.summary.rating;
        }
      } else if (state.sort === "vacancy") {
        if (a.summary.vrank !== b.summary.vrank) return a.summary.vrank - b.summary.vrank;
      } else if (state.sort === "distance" && origin) {
        if (a.entry.distance == null && b.entry.distance != null) return 1;
        if (b.entry.distance == null && a.entry.distance != null) return -1;
        if (a.entry.distance != null && b.entry.distance != null && a.entry.distance !== b.entry.distance) {
          return a.entry.distance - b.entry.distance;
        }
      }
      var nameCmp = a.entry.centre.name.localeCompare(b.entry.centre.name, undefined, { sensitivity: "base" });
      if (nameCmp) return nameCmp;
      return a.entry.centre.id - b.entry.centre.id;
    });
    return { rows: rows, tokens: tokens, excluded: excluded };
  }

  function programsHtml(programs) {
    if (!programs.length) return '<span class="muted">No program published</span>';
    return '<div class="progs">' + programs.map(function (program) {
      var mark = "";
      if (program[2] != null) {
        mark = ' <b class="' + (program[2] < 3 ? "low" : "ok") + '">' + esc(program[2].toFixed(2)) + "</b>";
      }
      return '<span class="prog">' + esc(program[0]) + mark + "</span>";
    }).join("") + "</div>";
  }

  function shortLabel(group, value) {
    var labels = (catalog.labels && catalog.labels[group]) || {};
    return labels[value] || value;
  }

  function cardHtml(row, state) {
    var centre = row.entry.centre;
    var bits = [];
    if (centre.auspice) bits.push(labelize(centre.auspice));
    if (centre.fee) bits.push(shortLabel("feeShort", centre.fee));
    if (centre.cwelcc) bits.push(shortLabel("cwelccShort", centre.cwelcc));
    var address = centre.address || "Address not published";
    if (centre.intersection) address += " (" + centre.intersection + ")";
    var postal = "";
    if (centre.postal && centre.postalM != null && centre.postalM <= DaycareFuzzy.POSTAL_DISPLAY_MAX_M) {
      postal = ' <span class="muted">' + esc(DaycareFuzzy.formatPostal(centre.postal)) + "</span>";
    }
    var ratingLabel = state.program ? "Rating" : "Highest rating";
    var rating = row.summary.rating == null
      ? ""
      : '<p class="rating-num ' + (row.summary.rating < 3 ? "low" : "") + '">' + esc(row.summary.rating.toFixed(2)) + "<small>" + esc(ratingLabel) + "</small></p>";
    var vacancy = row.summary.vacancy
      ? '<span class="badge ' + esc(row.summary.vacancy.toLowerCase()) + '">' + esc(row.summary.vacancy === "Yes" ? "Vacancy" : row.summary.vacancy === "No" ? "No vacancy" : "Vacancy unknown") + "</span>"
      : "";
    var distance = "";
    if (origin) {
      distance = row.entry.distance == null
        ? '<span class="dist muted">No map point</span>'
        : '<span class="dist">' + esc(DaycareFuzzy.formatKm(row.entry.distance)) + "</span>";
    }
    var phone = centre.phone
      ? '<a class="phone" href="' + esc(DaycarePlaces.telHref(centre.phone)) + '">' + esc(centre.phone) + "</a>"
      : "";
    var close = row.fuzzy ? '<span class="close-tag">Close spelling</span>' : "";
    var ward = centre.wardSlug
      ? '<a href="' + esc(DaycarePlaces.page("areas.html", { area: centre.wardSlug })) + '">' + esc(centre.ward) + "</a>"
      : esc(centre.ward || "");
    var status = "";
    if (vacancy || distance || phone) {
      status = '<div class="card-status">' + distance
        + '<span class="status-badge">' + vacancy + "</span>"
        + '<span class="status-phone">' + phone + "</span></div>";
    }
    return '<article class="card"><div class="card-top"><div class="card-body"><h2><a href="' + esc(DaycarePlaces.page("centre.html", { id: centre.id })) + '">' + esc(centre.name) + "</a></h2>"
      + '<p class="addr">' + esc(address) + postal + "</p>"
      + '<p class="meta">' + ward + (bits.length ? " · " + esc(bits.join(" · ")) : "") + "</p>"
      + close
      + '</div><div class="side">' + rating + '</div></div><div class="card-foot">'
      + programsHtml(row.summary.programs)
      + status
      + "</div></article>";
  }

  function syncChips(state) {
    var chips = document.querySelectorAll("[data-chip]");
    for (var i = 0; i < chips.length; i++) {
      var id = chips[i].getAttribute("data-chip");
      var pressed = false;
      if (id === "vacancy") pressed = state.vacancy === "Yes";
      else if (id === "rated") pressed = state.minRating === "3";
      else if (id === "near") pressed = state.km === "5" && !!origin;
      else pressed = state.program === id;
      chips[i].setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  }

  function postalFileLabel() {
    return (catalog.place && catalog.place.postalFileLabel) || "postal file";
  }

  function noteFor(state, excluded) {
    var notes = [];
    var fileLabel = postalFileLabel();
    if (postalStatus === "loading") notes.push("Looking up that postal code.");
    else if (postalStatus === "partial") notes.push("Finish all six characters, or use only the first three to search that whole area.");
    else if (postalStatus === "missing-point") notes.push(DaycareFuzzy.formatPostal(state.postal) + " is not in the " + fileLabel + ". " + state.postal.slice(0, 3) + " still searches that whole area.");
    else if (postalStatus === "missing") notes.push(DaycareFuzzy.formatPostal(state.postal) + " is not in the " + fileLabel + " used for distance.");
    else if (postalStatus === "invalid") notes.push("Enter a postal code such as A1A 1A1, or the first three characters such as A1A.");
    else if (postalStatus === "error") notes.push("The postal-code file did not load, so distance is unavailable.");
    else if ((state.km || state.sort === "distance") && !origin && state.postal === "") notes.push("Enter a postal code to use distance.");
    if (excluded) notes.push(excluded + (excluded === 1 ? " centre has" : " centres have") + " no address point, so " + (excluded === 1 ? "it is" : "they are") + " left out of distance search.");
    if (origin && origin.kind === "point") notes.push("Distance is the straight line from " + origin.label + " to each address point.");
    if (origin && origin.kind === "area") notes.push("Distance is the straight line from each address point to the nearest postal-code point in " + origin.label + ". Centres in that area come first.");
    return notes.join(" ");
  }

  function render() {
    if (!catalog) return;
    var state = read();
    writeUrl(state);
    syncChips(state);
    clearBtn.hidden = !state.q;
    var result = collect(state);
    var total = result.rows.length;
    var visible = result.rows.slice(0, shown);
    countEl.textContent = total.toLocaleString("en-CA") + (total === 1 ? " centre" : " centres");
    document.title = total.toLocaleString("en-CA") + (total === 1 ? " centre" : " centres") + " · Licensed child care";
    listEl.innerHTML = visible.map(function (row) { return cardHtml(row, state); }).join("");
    emptyEl.hidden = total !== 0;
    moreBtn.hidden = visible.length >= total;
    moreBtn.textContent = "Show more (" + (total - visible.length).toLocaleString("en-CA") + " left)";
    var note = noteFor(state, result.excluded);
    noteEl.hidden = !note;
    noteEl.textContent = note;
  }

  function refresh() {
    shown = SHOWN_STEP;
    var state = read();
    resolveOrigin(state).then(render);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 40);
  }

  function showLoadError() {
    countEl.textContent = "The centre list did not load.";
    emptyEl.hidden = false;
    emptyEl.querySelector("p").textContent = "Reload the page. Search needs the data file for the selected city.";
  }

  qInput.addEventListener("input", schedule);
  var postalInput = document.getElementById("postal");
  postalInput.addEventListener("input", schedule);
  postalInput.addEventListener("blur", function () {
    var code = compactPostal(postalInput.value);
    var shape = postalShape(code);
    if (shape === "point" || shape === "area") postalInput.value = DaycareFuzzy.formatPostal(code);
  });
  form.addEventListener("change", function (event) {
    if (event.target === qInput || event.target.id === "postal") return;
    refresh();
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    refresh();
  });
  clearBtn.addEventListener("click", function () {
    qInput.value = "";
    qInput.focus();
    refresh();
  });
  document.getElementById("chips").addEventListener("click", function (event) {
    var button = event.target.closest("[data-chip]");
    if (!button) return;
    var id = button.getAttribute("data-chip");
    var state = read();
    if (id === "vacancy") {
      setSelect("vacancy", state.vacancy === "Yes" ? "" : "Yes");
    } else if (id === "rated") {
      setSelect("min", state.minRating === "3" ? "" : "3");
    } else if (id === "near") {
      setSelect("km", state.km === "5" ? "" : "5");
      if (state.km !== "5") setSelect("sort", "distance");
      if (!read().postal) document.getElementById("postal").focus();
    } else {
      setSelect("program", state.program === id ? "" : id);
    }
    refresh();
  });
  document.getElementById("clear-filters").addEventListener("click", function () {
    ["km", "ward", "program", "vacancy", "min", "auspice", "fee", "cwelcc", "lang"].forEach(function (id) {
      setSelect(id, "");
    });
    document.getElementById("web").checked = false;
    document.getElementById("postal").value = "";
    if (document.getElementById("sort").value === "distance") setSelect("sort", DEFAULT_SORT);
    refresh();
  });
  document.getElementById("empty-clear").addEventListener("click", function () {
    qInput.value = "";
    document.getElementById("clear-filters").click();
  });
  moreBtn.addEventListener("click", function () {
    shown += SHOWN_STEP;
    render();
  });

  DaycarePlaces.ready
    .then(function () {
      return fetch(DaycarePlaces.fileUrl("catalog.json"));
    })
    .then(function (response) {
      if (!response.ok) throw new Error("catalog");
      return response.json();
    })
    .then(function (data) {
      catalog = data;
      paintIntro();
      fillFilters();
      entries = data.centres.map(function (centre) {
        var nameText = DaycareFuzzy.normalize(centre.name);
        var addrText = DaycareFuzzy.normalize([
          centre.address,
          centre.intersection,
          centre.ward,
          centre.postal,
          DaycareFuzzy.formatPostal(centre.postal)
        ].filter(Boolean).join(" "));
        var phoneDigits = String(centre.phone || "").replace(/\D/g, "");
        return {
          centre: centre,
          text: centre.text,
          words: wordsOf(centre.text),
          nameText: nameText,
          nameWords: wordsOf(nameText),
          addrText: addrText,
          addrWords: wordsOf(addrText),
          digits: phoneDigits + (centre.extraDigits || ""),
          distance: null
        };
      });
      return resolveOrigin(read());
    })
    .then(render)
    .catch(showLoadError);
})();
