globalThis.DaycareFuzzy = (function () {
  "use strict";

  var POSTAL_DISPLAY_MAX_M = 400;

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(query) {
    return normalize(query).split(" ").filter(function (token) {
      return token.length > 1;
    });
  }

  function formatPostal(code) {
    var compact = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (compact.length === 6) return compact.slice(0, 3) + " " + compact.slice(3);
    return compact;
  }

  function formatKm(kilometres) {
    var metres = kilometres * 1000;
    if (metres < 1000) return Math.round(metres) + " m";
    return kilometres.toFixed(1) + " km";
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var radius = 6371;
    var phi1 = lat1 * Math.PI / 180;
    var phi2 = lat2 * Math.PI / 180;
    var dphi = (lat2 - lat1) * Math.PI / 180;
    var dlambda = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dphi / 2) * Math.sin(dphi / 2)
      + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
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

  function levenshteinAtMost(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return null;
    if (a.length > b.length) {
      var swap = a;
      a = b;
      b = swap;
    }
    var prev = new Array(a.length + 1);
    for (var i = 0; i <= a.length; i++) prev[i] = i;
    for (var j = 1; j <= b.length; j++) {
      var cur = new Array(a.length + 1);
      cur[0] = j;
      var rowMin = cur[0];
      var bj = b.charCodeAt(j - 1);
      for (var k = 1; k <= a.length; k++) {
        var cost = a.charCodeAt(k - 1) === bj ? 0 : 1;
        var del = prev[k] + 1;
        var ins = cur[k - 1] + 1;
        var sub = prev[k - 1] + cost;
        var value = del < ins ? del : ins;
        if (sub < value) value = sub;
        cur[k] = value;
        if (value < rowMin) rowMin = value;
      }
      if (rowMin > max) return null;
      prev = cur;
    }
    return prev[a.length] <= max ? prev[a.length] : null;
  }

  function maxDistFor(token) {
    // Codes and short words stay exact. "halal" must not match "hall",
    // and one postal code must not match a neighbour.
    if (/\d/.test(token)) return 0;
    if (token.length >= 8) return 2;
    if (token.length >= 6) return 1;
    return 0;
  }

  function sharedPrefixLength(a, b) {
    var limit = a.length < b.length ? a.length : b.length;
    var i = 0;
    while (i < limit && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
  }

  function bestEdit(words, token, maxDist) {
    var best = 0;
    var first = token.charCodeAt(0);
    // Two edits are allowed only when the word and the query still share a long
    // start. That keeps "montesor" on Montessori and keeps "childcre" off "children".
    var minPrefix = maxDist > 1 ? token.length - 2 : 1;
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.charCodeAt(0) !== first) continue;
      if (sharedPrefixLength(word, token) < minPrefix) continue;
      var distance = null;
      if (Math.abs(word.length - token.length) <= maxDist) {
        distance = levenshteinAtMost(word, token, maxDist);
      } else if (word.length > token.length && token.length >= 6) {
        distance = levenshteinAtMost(word.slice(0, token.length), token, 1);
      }
      if (distance == null) continue;
      var score = 78 - distance * 16;
      if (score > best) best = score;
      if (best >= 62) return best;
    }
    return best;
  }

  function joinedPairScore(words, token) {
    if (token.length < 5) return 0;
    for (var i = 0; i < words.length - 1; i++) {
      var pair = words[i] + words[i + 1];
      if (pair === token) return 84;
      // Prefix only. Edit distance on joined words treats the boilerplate
      // phrase "child care" as a typo of almost any similar token.
      if (token.length >= 6 && pair.startsWith(token)) return 76;
    }
    return 0;
  }

  function tokenScore(token, text, words, digits) {
    if (!token) return 0;
    if (/^\d{6,}$/.test(token) && digits.indexOf(token) !== -1) return 120;
    var at = text.indexOf(token);
    if (at !== -1) {
      var startEdge = at === 0 || text.charCodeAt(at - 1) === 32;
      var end = at + token.length;
      var endEdge = end === text.length || text.charCodeAt(end) === 32;
      if (startEdge && endEdge) return 140;
      if (startEdge) return 115;
      return 90;
    }
    var pairScore = joinedPairScore(words, token);
    if (pairScore) return pairScore;
    var maxDist = maxDistFor(token);
    if (!maxDist) return 0;
    return bestEdit(words, token, maxDist);
  }

  function tokenIsFuzzy(token, entry) {
    if (!token) return false;
    if (entry.text.indexOf(token) !== -1) return false;
    if (/^\d{6,}$/.test(token) && entry.digits.indexOf(token) !== -1) return false;
    for (var i = 0; i < entry.words.length - 1; i++) {
      if (entry.words[i] + entry.words[i + 1] === token) return false;
    }
    return true;
  }

  function scoreEntry(entry, tokens) {
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var any = tokenScore(token, entry.text, entry.words, entry.digits);
      if (!any) return 0;
      var name = tokenScore(token, entry.nameText, entry.nameWords, "");
      var addr = tokenScore(token, entry.addrText, entry.addrWords, entry.digits);
      total += any + (name ? 70 : 0) + (addr ? 20 : 0);
    }
    return total;
  }

  function pushParts(parts, values) {
    for (var i = 0; i < values.length; i++) {
      if (values[i]) parts.push(values[i]);
    }
  }

  function buildEntry(centre, origin) {
    var parts = [];
    pushParts(parts, [
      centre.name,
      centre.address,
      centre.intersection,
      centre.ward,
      centre.contactName,
      centre.phone,
      centre.auspice,
      centre.ageRange,
      centre.description,
      centre.building,
      centre.feeSubsidy,
      centre.cwelcc,
      centre.cityNotice,
      centre.scheduleNote,
      centre.postalCode,
      formatPostal(centre.postalCode),
      centre.consultantName,
      centre.ecbName
    ]);
    var sites = centre.websites || [];
    for (var s = 0; s < sites.length; s++) {
      pushParts(parts, [sites[s].url, sites[s].label]);
    }
    var programs = centre.programs || [];
    for (var p = 0; p < programs.length; p++) {
      pushParts(parts, [programs[p].name, programs[p].group, programs[p].vacancy]);
    }
    var details = centre.details || [];
    for (var d = 0; d < details.length; d++) {
      parts.push(details[d].section);
      var items = details[d].items || [];
      for (var n = 0; n < items.length; n++) parts.push(items[n]);
    }
    var text = normalize(parts.join(" "));
    var nameText = normalize(centre.name);
    var addrText = normalize([
      centre.address,
      centre.intersection,
      centre.ward,
      centre.postalCode,
      formatPostal(centre.postalCode)
    ].filter(Boolean).join(" "));
    var digits = String(centre.phone || "").replace(/\D/g, "")
      + String(centre.consultantPhone || "").replace(/\D/g, "")
      + String(centre.ecbPhone || "").replace(/\D/g, "");
    var distance = null;
    if (origin && centre.latitude != null && centre.longitude != null) {
      distance = haversineKm(origin.lat, origin.lon, centre.latitude, centre.longitude);
    }
    return {
      centre: centre,
      text: text,
      words: wordsOf(text),
      nameText: nameText,
      nameWords: wordsOf(nameText),
      addrText: addrText,
      addrWords: wordsOf(addrText),
      digits: digits,
      distance: distance
    };
  }

  return {
    POSTAL_DISPLAY_MAX_M: POSTAL_DISPLAY_MAX_M,
    normalize: normalize,
    tokenize: tokenize,
    formatPostal: formatPostal,
    formatKm: formatKm,
    haversineKm: haversineKm,
    buildEntry: buildEntry,
    scoreEntry: scoreEntry,
    tokenIsFuzzy: tokenIsFuzzy
  };
})();
