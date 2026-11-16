// Light / dark mode. Loaded in <head> so the right colours are applied before the page shows.
(function () {
  var KEY = 'madrasti_theme';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = theme === 'dark' ? '☀️' : '🌙';
      buttons[i].setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      buttons[i].setAttribute('aria-label', buttons[i].getAttribute('title'));
    }
  }
  var current = saved() || system();
  apply(current);

  window.MadrastiTheme = {
    get: function () { return current; },
    set: function (theme) { current = theme; try { localStorage.setItem(KEY, theme); } catch (e) {} apply(theme); },
    toggle: function () { this.set(current === 'dark' ? 'light' : 'dark'); },
    refresh: function () { apply(current); },
  };

  // Any element with data-theme-toggle switches the mode (works for buttons added later too)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (btn) { e.preventDefault(); window.MadrastiTheme.toggle(); }
  });
  document.addEventListener('DOMContentLoaded', function () { apply(current); });
  // Follow the system setting while the user has not chosen
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!saved()) { current = system(); apply(current); } });
  }
})();
