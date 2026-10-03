(function () {
  "use strict";

  var mode = document.body.getAttribute("data-page");
  var titleEl = document.getElementById("page-title");
  var ledeEl = document.getElementById("page-lede");
  var crumbEl = document.getElementById("crumb");
  var directoryEl = document.getElementById("directory");
  var listEl = document.getElementById("list");

  function esc(value) {
    return DaycarePlaces.esc(value);
  }

  function labelize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function bestRating(programs) {
    var rating = null;
    for (var i = 0; i < programs.length; i++) {
      if (programs[i][2] != null && (rating == null || programs[i][2] > rating)) rating = programs[i][2];
    }
    return rating;
  }

  function card(centre, programName) {
    var programs = centre.programs || [];
    if (programName) programs = programs.filter(function (program) { return program[0] === programName; });
    var chips = programs.map(function (program) {
      var mark = program[2] == null ? "" : ' <b class="' + (program[2] < 3 ? "low" : "ok") + '">' + esc(program[2].toFixed(2)) + "</b>";
      var vacancy = program[1] ? ' <span class="badge ' + esc(String(program[1]).toLowerCase()) + '">' + esc(program[1]) + "</span>" : "";
      return '<span class="prog">' + esc(program[0] || "") + mark + vacancy + "</span>";
    }).join("");
    var rating = bestRating(programs);
    var side = rating == null ? "" : '<p class="rating-num' + (rating < 3 ? " low" : "") + '">' + esc(rating.toFixed(2)) + "</p>";
    var phone = centre.phone
      ? '<a class="phone" href="' + esc(DaycarePlaces.telHref(centre.phone)) + '">' + esc(centre.phone) + "</a>"
      : "";
    var area = "";
    if (mode === "programs" && centre.wardSlug) {
      area = '<a href="' + esc(DaycarePlaces.page("areas.html", { area: centre.wardSlug })) + '">' + esc(centre.ward) + "</a> · ";
    }
    var status = phone
      ? '<div class="card-status"><span class="status-badge"></span><span class="status-phone">' + phone + "</span></div>"
      : "";
    return '<article class="card"><div class="card-top"><div class="card-body"><h2><a href="' + esc(DaycarePlaces.page("centre.html", { id: centre.id })) + '">' + esc(centre.name) + "</a></h2>"
      + '<p class="addr">' + area + esc(centre.address || "Address not published") + "</p>"
      + (centre.auspice ? '<p class="meta">' + esc(labelize(centre.auspice)) + "</p>" : "")
      + '</div><div class="side">' + side + '</div></div><div class="card-foot"><div class="progs">' + chips + "</div>"
      + status + "</div></article>";
  }

  function directory(items, param) {
    var peak = 1;
    items.forEach(function (item) { if (item.count > peak) peak = item.count; });
    directoryEl.hidden = false;
    listEl.hidden = true;
    directoryEl.innerHTML = items.map(function (item) {
      var width = Math.max(8, Math.round(100 * item.count / peak));
      var extra = {};
      extra[param] = item.slug;
      return '<li><a href="' + esc(DaycarePlaces.page(mode === "areas" ? "areas.html" : "programs.html", extra)) + '"><strong>' + esc(item.name) + "</strong><em>" + item.count + " centres</em><span class=\"bar-track\"><span style=\"width:" + width + "%\"></span></span></a></li>";
    }).join("");
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
      DaycarePlaces.paintFooter(meta);
      var params = new URLSearchParams(location.search);
      if (mode === "areas") {
        var slug = params.get("area") || "";
        var ward = null;
        (catalog.wards || []).forEach(function (item) { if (item.slug === slug) ward = item; });
        if (!ward) {
          titleEl.textContent = "Areas";
          ledeEl.textContent = meta.areaIntro || "";
          document.title = "Areas · Licensed child care";
          crumbEl.hidden = true;
          directory((catalog.wards || []).slice().sort(function (a, b) {
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          }), "area");
          return;
        }
        titleEl.textContent = ward.name;
        ledeEl.innerHTML = ward.count + " centres with this " + esc((place.areaLabel || "area").toLowerCase()) + ' name. <a href="' + esc(DaycarePlaces.page("index.html", { ward: ward.name })) + '">Search within this ' + esc((place.areaLabel || "area").toLowerCase()) + "</a>.";
        document.title = ward.name + " · Licensed child care";
        crumbEl.hidden = false;
        crumbEl.innerHTML = '<a href="' + esc(DaycarePlaces.page("areas.html")) + '">' + esc(place.areaLabelPlural || "Areas") + "</a>";
        directoryEl.hidden = true;
        listEl.hidden = false;
        var rows = (catalog.centres || []).filter(function (centre) { return centre.wardSlug === ward.slug; });
        rows.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id; });
        listEl.innerHTML = rows.map(function (centre) { return card(centre); }).join("");
        return;
      }
      var programSlug = params.get("program") || "";
      var program = null;
      (catalog.programs || []).forEach(function (item) { if (item.slug === programSlug) program = item; });
      if (!program) {
        titleEl.textContent = "Programs";
        ledeEl.textContent = meta.programIntro || "";
        document.title = "Programs · Licensed child care";
        crumbEl.hidden = true;
        directory(catalog.programs || [], "program");
        return;
      }
      var article = /^[aeiou]/i.test(program.name) ? "an" : "a";
      titleEl.textContent = program.name;
      ledeEl.innerHTML = program.count + " centres publish " + article + " " + esc(program.name) + ' program. The rating and vacancy here are for that program. <a href="' + esc(DaycarePlaces.page("index.html", { program: program.name })) + '">Filter search to ' + esc(program.name) + "</a>.";
      document.title = program.name + " · Licensed child care";
      crumbEl.hidden = false;
      crumbEl.innerHTML = '<a href="' + esc(DaycarePlaces.page("programs.html")) + '">Programs</a>';
      directoryEl.hidden = true;
      listEl.hidden = false;
      var matched = (catalog.centres || []).filter(function (centre) {
        return (centre.programs || []).some(function (row) { return row[0] === program.name; });
      });
      matched.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id; });
      listEl.innerHTML = matched.map(function (centre) { return card(centre, program.name); }).join("");
    })
    .catch(function () {
      titleEl.textContent = "List unavailable";
      ledeEl.textContent = "Reload the page. This list needs the data file for the selected city.";
    });
})();
