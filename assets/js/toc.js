/*

    Poison's original toc.js behaviour may be inconsistent in must cases.

    The original implementation tracked the last visible heading from the
    batch delivered by the IntersectionObserver as the active section. Since
    nearby headings often enter the viewport together, the lower one would
    take precedence.

    Because it relied solely on visible headings, the highlight would also
    freeze in the middle of a long section when no heading was currently in
    view. In this version, the active section is the last one whose heading
    has already passed the reading line—located just below the top of the
    window. The calculation is performed consistently for every frame,
    independent of the order in which the browser delivers events.

*/

(function () {
  "use strict";

  // Distance from the top of the window that counts as the reading line. It must
  // fit between two adjacent headings: the anchor places the clicked heading at
  // 0, and the line must not reach the next heading. The smallest interval
  // observed in the posts is 82px, with one heading immediately below the other.

  var READING_LINE = 48;

  function findScroll(element) {
    for (var no = element; no && no !== document.body; no = no.parentElement) {
      var overflow = getComputedStyle(no).overflowY;
      if (
        (overflow === "auto" || overflow === "scroll") &&
        no.scrollHeight > no.clientHeight + 1
      ) {
        return no;
      }
    }
    return null; // own window
  }

  function start() {
    var nav = document.querySelector("nav#TableOfContents");
    var post = document.querySelector(".post");
    if (!nav || !post) {
      return;
    }

    // Only headings actually listed in the table of contents are included:
    // hugo.toml's startLevel and endLevel settings might exclude a heading,
    // meaning there is no <li> to target. We start from the links
    // rather than the headings.
    var itens = [];
    Array.prototype.forEach.call(
      nav.querySelectorAll('li > a[href^="#"]'),
      function (link) {
        var target = link.getAttribute("href").slice(1);
        var id;
        try {
          id = decodeURIComponent(target);
        } catch (error) {
          id = target;
        }
        var title = id ? document.getElementById(id) : null;
        if (title && post.contains(title)) {
          itens.push({ title: title, li: link.parentElement });
        }
      },
    );

    if (!itens.length) {
      return;
    }

    var scroll = findScroll(post);
    var listener = scroll || window;
    var summaryBox = findScroll(nav);
    var active = null;
    var fixed = null;
    var scheduled = false;

    function atEnd() {
      if (scroll) {
        return (
          scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2
        );
      }
      return (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      );
    }

    function atReading() {
      // Near the end, the final sections might never reach the reading line
      // because there is no more scrolling left. In that case, the last one applies.
      if (atEnd()) {
        return itens[itens.length - 1];
      }
      var choosen = itens[0];
      for (var i = 0; i < itens.length; i++) {
        if (itens[i].title.getBoundingClientRect().top <= READING_LINE) {
          choosen = itens[i];
        } else {
          break;
        }
      }
      return choosen;
    }

    function mark(item) {
      if (item === active) {
        return;
      }
      active = item;
      itens.forEach(function (other) {
        var actual = other === item;
        other.li.classList.toggle("active", actual);
        other.li.classList.toggle("inactive", !actual);
      });
      reveal(item);
    }

    // The long table of contents scrolls internally, so the highlighted section
    // might be outside the visible area. The calculation is done manually
    // rather than using scrollIntoView, which would also shift the parent
    // scroll container.
    function reveal(item) {
      if (!summaryBox) {
        return;
      }
      var box = summaryBox.getBoundingClientRect();
      var entry = item.li.getBoundingClientRect();
      var gap = 16;
      if (entry.top < box.top + gap) {
        summaryBox.scrollTop -= box.top + gap - entry.top;
      } else if (entry.bottom > box.bottom - gap) {
        summaryBox.scrollTop += entry.bottom - (box.bottom - gap);
      }
    }

    function update() {
      scheduled = false;
      mark(fixed || atReading());
    }

    function schedule() {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    }

    // Click on the table of contents, the requested section is the one the reader wants,
    // even if the anchor stops a few pixels short of the next heading. The fixed
    // state is released as soon as the calculation aligns with the click again.
    nav.addEventListener("click", function (event) {
      var link = event.target.closest('li > a[href^="#"]');
      if (!link) {
        return;
      }
      for (var i = 0; i < itens.length; i++) {
        if (itens[i].li === link.parentElement) {
          fixed = itens[i];
          mark(fixed);
          break;
        }
      }
    });

    listener.addEventListener(
      "scroll",
      function () {
        if (fixed && atReading() === fixed) {
          fixed = null;
        }
        schedule();
      },
      { passive: true },
    );

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);

    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
