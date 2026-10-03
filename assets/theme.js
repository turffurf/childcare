(function () {
  "use strict";

  var THEMES = [
    { id: "sage", color: "#14332f" },
    { id: "sea", color: "#16344a" },
    { id: "sand", color: "#4a3828" },
    { id: "lilac", color: "#3c3354" },
    { id: "rose", color: "#4a3034" },
    { id: "stone", color: "#2c3330" }
  ];
  var KEY = "daycare-theme";

  function known(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return THEMES[0];
  }

  function apply(id) {
    var theme = known(id);
    if (theme.id === "sage") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme.id);
    try { localStorage.setItem(KEY, theme.id); } catch (error) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.color);
    var choices = document.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < choices.length; i++) {
      var chosen = choices[i].getAttribute("data-theme-choice") === theme.id;
      choices[i].setAttribute("aria-pressed", chosen ? "true" : "false");
    }
  }

  var active = document.documentElement.getAttribute("data-theme") || "sage";
  apply(active);
  document.addEventListener("click", function (event) {
    var choice = event.target.closest("[data-theme-choice]");
    if (!choice) return;
    apply(choice.getAttribute("data-theme-choice"));
  });
})();
