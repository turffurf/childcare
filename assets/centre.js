(function () {
  "use strict";

  var root = document.getElementById("centre-root");

  function esc(value) {
    return DaycarePlaces.esc(value);
  }

  function httpUrl(url) {
    if (!url || /\s/.test(url)) return "";
    if (/^https?:\/\/https?:\/\//i.test(url)) return "";
    if (!/^https?:\/\/([^/?#\s]+)/i.test(url)) return "";
    return url;
  }

  function labelize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function external(href, label) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + "</a>";
  }

  function fact(label, inner) {
    return "<div><dt>" + esc(label) + "</dt><dd>" + inner + "</dd></div>";
  }

  function factText(label, value) {
    return fact(label, esc(value || "Not published"));
  }

  function resolveWebsite(url, label) {
    var raw = String(url || "").trim();
    var text = String(label || raw).trim();
    var direct = httpUrl(raw);
    if (direct) return { href: direct, text: text || direct, note: "" };
    var fromLabel = httpUrl(text);
    if (fromLabel) {
      return {
        href: fromLabel,
        text: text,
        note: raw ? "The published link address is “" + raw + "”. The link uses the address shown as the link text." : ""
      };
    }
    if (text.toLowerCase().indexOf("www.") === 0 && !/\s/.test(text)) {
      return {
        href: "http://" + text,
        text: text,
        note: raw ? "The published link address is “" + raw + "”. The link uses http:// followed by the link text." : ""
      };
    }
    return { href: "", text: text || raw || "Website text was blank", note: raw ? "The published link address is “" + raw + "”." : "" };
  }

  function websiteBlock(sites) {
    if (!sites || !sites.length) return "No website listed on the centre page";
    return sites.map(function (site) {
      var resolved = resolveWebsite(site.url, site.label);
      var link = resolved.href ? external(resolved.href, resolved.text) : esc(resolved.text);
      var note = resolved.note ? '<span class="meta">' + esc(resolved.note) + "</span>" : "";
      return '<span class="site-link">' + link + note + "</span>";
    }).join("");
  }

  function firstWebsite(sites) {
    for (var i = 0; i < (sites || []).length; i++) {
      var resolved = resolveWebsite(sites[i].url, sites[i].label);
      if (resolved.href) return resolved;
    }
    return null;
  }

  function personHtml(name, phone, note) {
    if (!name || !phone) return "Not published";
    var html = esc(name) + ', <a href="' + esc(DaycarePlaces.telHref(phone)) + '">' + esc(phone) + "</a>";
    if (note) {
      var first = note.charAt(0);
      html += (first >= "a" && first <= "z" ? ", " : ". ") + esc(note);
    }
    return html;
  }

  function programTable(programs, programSlugs, meta) {
    if (!programs || !programs.length) return "<p>No program rows were published on this centre’s page.</p>";
    var rows = programs.map(function (program) {
      var name = program.name || "";
      var slug = programSlugs[name];
      var nameHtml = slug
        ? '<a href="' + esc(DaycarePlaces.page("programs.html", { program: slug })) + '">' + esc(name) + "</a>"
        : esc(name);
      var capacity = program.capacity == null ? "Not published" : String(program.capacity);
      var vacancy = program.vacancy || "Not published";
      var vacancyHtml = esc(vacancy);
      if (program.vacancy === "Yes" || program.vacancy === "No" || program.vacancy === "Unknown") {
        vacancyHtml = '<span class="badge ' + esc(program.vacancy.toLowerCase()) + '">' + esc(vacancy) + "</span>";
      }
      var ratingHtml = "Not published";
      if (program.rating != null) {
        var label = program.ratingText && program.ratingText !== "-" ? program.ratingText : program.rating.toFixed(2) + " / 5";
        var href = httpUrl(program.ratingUrl);
        ratingHtml = href ? external(href, label) : esc(label);
        if (program.rating < 3) ratingHtml += '<span class="badge low">' + esc(meta.ratingBelow || "Below the published minimum") + "</span>";
      }
      return "<tr><td data-label=\"Program\">" + nameHtml + "</td><td data-label=\"Group\">" + esc(program.group || "") + "</td><td data-label=\"Capacity\">" + esc(capacity) + "</td><td data-label=\"Vacancy\">" + vacancyHtml + "</td><td data-label=\"Rating\">" + ratingHtml + "</td></tr>";
    }).join("");
    return '<table class="programs"><thead><tr><th>Program</th><th>Group on the centre page</th><th>Capacity</th><th>Vacancy</th><th>Quality rating</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function nearbyHtml(centre, catalog) {
    var title = "Nearby centres";
    var neighbours = [];
    if (centre.latitude != null && centre.longitude != null) {
      (catalog.centres || []).forEach(function (other) {
        if (other.id === centre.id || other.lat == null || other.lon == null) return;
        neighbours.push({
          distance: DaycareFuzzy.haversineKm(centre.latitude, centre.longitude, other.lat, other.lon),
          other: other
        });
      });
      neighbours.sort(function (a, b) {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return String(a.other.name).localeCompare(String(b.other.name));
      });
      neighbours = neighbours.slice(0, 4);
    } else {
      title = "Other centres in this " + (catalog.place.areaLabel || "area").toLowerCase();
      (catalog.centres || []).forEach(function (other) {
        if (other.id !== centre.id && other.ward && other.ward === centre.ward) neighbours.push({ distance: null, other: other });
      });
      neighbours.sort(function (a, b) {
        return String(a.other.name).localeCompare(String(b.other.name));
      });
      neighbours = neighbours.slice(0, 4);
    }
    if (!neighbours.length) return "";
    var cards = neighbours.map(function (item) {
      var distance = item.distance == null ? "" : " · " + DaycareFuzzy.formatKm(item.distance);
      return '<li><a href="' + esc(DaycarePlaces.page("centre.html", { id: item.other.id })) + '"><strong>' + esc(item.other.name) + "</strong><span>" + esc(item.other.address || "Address not published") + esc(distance) + "</span></a></li>";
    }).join("");
    return '<section style="margin-top:22px"><h2>' + esc(title) + '</h2><ul class="nearby">' + cards + "</ul></section>";
  }

  function render(centre, catalog) {
    var meta = catalog.meta || {};
    var place = catalog.place || {};
    var labels = catalog.labels || {};
    var programSlugs = Object.create(null);
    (catalog.programs || []).forEach(function (program) { programSlugs[program.name] = program.slug; });
    document.title = centre.name + " · Licensed child care";
    DaycarePlaces.paintFooter(meta);

    var address = centre.address || "Not published";
    if (centre.intersection) address += " (" + centre.intersection + ")";
    var phoneHtml = "Not published";
    if (centre.phone) {
      var call = '<a href="' + esc(DaycarePlaces.telHref(centre.phone)) + '">' + esc(centre.phone) + "</a>";
      phoneHtml = centre.contactName ? esc(centre.contactName) + ", " + call : call;
    }
    var location = "";
    if (centre.latitude != null && centre.longitude != null) {
      var matched = centre.addressMatched || centre.address || "Address point";
      location += fact(meta.addressPointLabel || "Address point", esc(matched + ". Latitude " + centre.latitude.toFixed(6) + ", longitude " + centre.longitude.toFixed(6) + "."));
      if (centre.postalCode && centre.postalMetres != null && centre.postalMetres <= DaycareFuzzy.POSTAL_DISPLAY_MAX_M) {
        location += fact("Postal code", esc("Nearest postal-code point " + DaycareFuzzy.formatPostal(centre.postalCode) + ", " + Math.round(centre.postalMetres) + " m from the address point. The centre page does not publish a postal code. This one is the nearest point in the postal-code file."));
      } else {
        location += fact("Postal code", esc("No postal-code point is within " + DaycareFuzzy.POSTAL_DISPLAY_MAX_M + " m of this address point. The centre page does not publish a postal code."));
      }
    } else {
      location += fact("Postal code", "This street address was not matched to an address point, so this centre is left out of distance search.");
    }

    var actions = [];
    if (centre.phone) actions.push('<a class="primary" href="' + esc(DaycarePlaces.telHref(centre.phone)) + '">Call</a>');
    if (centre.latitude != null && centre.longitude != null) {
      actions.push('<a href="' + esc("https://www.google.com/maps/search/?api=1&query=" + centre.latitude + "," + centre.longitude) + '" target="_blank" rel="noopener noreferrer">Map</a>');
    } else if (centre.address) {
      actions.push('<a href="' + esc("https://www.google.com/maps/search/?api=1&query=" + centre.address + ", " + place.name) + '" target="_blank" rel="noopener noreferrer">Map</a>');
    }
    var website = firstWebsite(centre.websites);
    if (website) actions.push(external(website.href, "Website"));
    var cityUrl = httpUrl(centre.cityUrl);
    if (cityUrl) actions.push(external(cityUrl, "Source page"));

    var wardHtml = esc(centre.ward || "Not published");
    if (centre.wardSlug && centre.ward) {
      wardHtml = '<a href="' + esc(DaycarePlaces.page("areas.html", { area: centre.wardSlug })) + '">' + esc(centre.ward) + "</a>";
    }
    var bits = [];
    if (centre.auspice) bits.push(labelize(centre.auspice));
    if (centre.ageRange) bits.push(centre.ageRange);
    if (centre.ward) bits.push(centre.ward);

    var groups = (centre.details || []).map(function (group) {
      var items = (group.items || []).map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("");
      return '<section class="panel"><h2>' + esc(group.section || "Details") + "</h2><ul>" + items + "</ul></section>";
    }).join("");
    if (groups && meta.detailsFine) groups += '<p class="fine">' + esc(meta.detailsFine) + "</p>";

    var fee = (labels.fees && labels.fees[centre.feeSubsidy]) || centre.feeSubsidy || "Not published";
    var cwelcc = (labels.cwelcc && labels.cwelcc[centre.cwelcc]) || centre.cwelcc || "Not published";
    var searchHref = DaycarePlaces.page("index.html");

    root.innerHTML = ''
      + '<p class="crumb"><a href="' + esc(searchHref) + '">Search</a> · ' + wardHtml + "</p>"
      + '<header class="centre-head"><h1>' + esc(centre.name) + "</h1>"
      + '<p class="subhead">' + esc(bits.join(" · ")) + "</p>"
      + '<div class="actions">' + actions.join("") + "</div></header>"
      + (centre.scheduleNote ? '<p class="banner">' + esc(centre.scheduleNote) + "</p>" : "")
      + (centre.cityNotice ? '<p class="banner notice">' + esc(centre.cityNotice) + "</p>" : "")
      + '<div class="split"><section class="panel"><h2>Programs and quality ratings</h2>'
      + programTable(centre.programs, programSlugs, meta)
      + '<p class="fine">' + esc(meta.ratingFine || "") + "</p></section>"
      + '<section class="panel"><h2>Centre</h2><dl class="facts">'
      + fact("Address", esc(address))
      + location
      + fact((place.areaLabel || "Area") + " printed on the page", wardHtml)
      + factText("Ages served", centre.ageRange)
      + fact("Building", esc(centre.building || "Not published"))
      + fact("Centre contact", phoneHtml)
      + fact("Website", websiteBlock(centre.websites))
      + fact("Source page", cityUrl ? external(cityUrl, "Published centre page") : "Not published")
      + factText("Operator", centre.auspice ? labelize(centre.auspice) : "Not stated on the centre page")
      + factText("Fee subsidy", fee)
      + factText("Canada-Wide Early Learning and Child Care", cwelcc)
      + fact("Description", esc(centre.description || "Not published"))
      + "</dl></section></div>"
      + '<div class="blocks">' + groups + "</div>"
      + '<section class="panel" style="margin-top:18px"><h2>Contacts on this page</h2><dl class="facts">'
      + fact(meta.consultantLabel || "Consultant", personHtml(centre.consultantName, centre.consultantPhone, centre.consultantNote))
      + fact(meta.ecbLabel || "Resource consultation staff", personHtml(centre.ecbName, centre.ecbPhone, centre.ecbNote))
      + factText("Page last updated", centre.pageUpdated)
      + factText("List retrieved", meta.retrievedLabel || meta.retrievedAt)
      + "</dl></section>"
      + nearbyHtml(centre, catalog);
  }

  function fail(message) {
    root.innerHTML = '<h1>Centre not available</h1><p class="lede">' + esc(message) + '</p><p><a id="back-search" href="index.html">Search centres</a></p>';
    var link = document.getElementById("back-search");
    if (link && DaycarePlaces.path()) link.href = DaycarePlaces.page("index.html");
  }

  DaycarePlaces.ready
    .then(function () {
      var id = new URLSearchParams(location.search).get("id") || "";
      if (!/^\d+$/.test(id)) throw new Error("missing");
      return Promise.all([
        fetch(DaycarePlaces.fileUrl("catalog.json")).then(function (response) {
          if (!response.ok) throw new Error("catalog");
          return response.json();
        }),
        fetch(DaycarePlaces.fileUrl("centres.json")).then(function (response) {
          if (!response.ok) throw new Error("centres");
          return response.json();
        })
      ]).then(function (files) {
        var centre = files[1][id];
        if (!centre) throw new Error("missing");
        render(centre, files[0]);
      });
    })
    .catch(function (error) {
      fail(error && error.message === "missing"
        ? "That centre is not in the selected city’s list."
        : "The centre record did not load.");
    });
})();
