/**
 * SEM-GOV-001D-HOME1 — Home page interactions (static only).
 */
(function () {
  'use strict';

  function qs(id) {
    return document.getElementById(id);
  }

  function bindMobileNav() {
    var toggle = qs('home-nav-toggle');
    var nav = qs('home-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('home-nav--open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function bindSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (ev) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (history.replaceState) {
          history.replaceState(null, '', id);
        }
      });
    });
  }

  function bindBackToTop() {
    var btn = qs('back-to-top');
    if (!btn) return;

    function toggle() {
      if (window.scrollY > 320) {
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }
    }

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  function init() {
    bindMobileNav();
    bindSmoothAnchors();
    bindBackToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
