(function () {
  "use strict";

  function esc(value) {
    return DaycarePlaces.esc(value);
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
      var about = (catalog.meta && catalog.meta.about) || {};
      DaycarePlaces.paintFooter(catalog.meta);
      document.getElementById("page-title").textContent = "About this list";
      document.getElementById("page-lede").textContent = about.lede || "";
      var html = (about.sections || []).map(function (section) {
        var paragraphs = (section.paragraphs || []).map(function (paragraph) {
          return "<p>" + esc(paragraph) + "</p>";
        }).join("");
        var links = (section.links || []).map(function (link) {
          return '<li><a href="' + esc(link.href) + '" target="_blank" rel="noopener noreferrer">' + esc(link.label) + "</a></li>";
        }).join("");
        return "<h2>" + esc(section.title || "") + "</h2>" + paragraphs + (links ? "<ul>" + links + "</ul>" : "");
      }).join("");
      document.getElementById("about-body").innerHTML = html;
    })
    .catch(function () {
      document.getElementById("page-lede").textContent = "The description for this city did not load.";
    });
})();
