/* Progressive enhancements. All paper content lives in index.html. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Result tables remain ordinary HTML, enhanced with accessible tabs.
  const resultTabs = $$('[data-result-tab]');
  const resultPanels = $$('[data-result-panel]');
  const resultTabList = resultTabs[0]?.closest('.tabs');
  let activeResultTab;
  let resultEntrance;

  function positionTabIndicator() {
    if (!resultTabList || !activeResultTab) return;
    const tab = activeResultTab.getBoundingClientRect();
    const list = resultTabList.getBoundingClientRect();
    resultTabList.style.setProperty('--tab-left', `${tab.left - list.left - resultTabList.clientLeft}px`);
    resultTabList.style.setProperty('--tab-width', `${tab.width}px`);
    resultTabList.classList.add('is-enhanced');
  }

  function activateTab(tab, focus = false, animate = true) {
    if (!tab) return;
    const changed = activeResultTab !== tab;
    activeResultTab = tab;
    resultTabs.forEach(button => {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    resultPanels.forEach(panel => {
      panel.hidden = panel.dataset.resultPanel !== tab.dataset.resultTab;
    });
    positionTabIndicator();
    if (changed) {
      resultEntrance?.cancel();
      const panel = resultPanels.find(item => !item.hidden);
      if (animate && !reducedMotion.matches && panel?.animate) {
        resultEntrance = panel.animate([
          {opacity: 0, transform: 'translateY(6px)'},
          {opacity: 1, transform: 'translateY(0)'}
        ], {duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)'});
      }
    }
    if (focus) tab.focus();
  }

  activateTab(resultTabs.find(tab => tab.getAttribute('aria-selected') === 'true') || resultTabs[0], false, false);
  if (resultTabList && 'ResizeObserver' in window) new ResizeObserver(positionTabIndicator).observe(resultTabList);
  else addEventListener('resize', positionTabIndicator);
  document.fonts?.ready.then(positionTabIndicator);
  resultTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % resultTabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + resultTabs.length) % resultTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = resultTabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        activateTab(resultTabs[next], true);
      }
    });
  });

  // Native disclosure semantics remain intact; only the height change is animated.
  $$('.analysis-module').forEach(details => {
    const summary = $('summary', details);
    if (!summary) return;

    let animation;
    let targetOpen = details.open;
    let previousWidth = details.getBoundingClientRect().width;

    function finish(open) {
      const pending = animation;
      animation = null;
      pending?.cancel();
      details.open = open;
      targetOpen = open;
      details.style.removeProperty('overflow');
      delete details.dataset.transitionState;
    }

    function transition(open) {
      const startHeight = details.getBoundingClientRect().height;
      const pending = animation;
      animation = null;
      pending?.cancel();
      targetOpen = open;
      details.open = true;
      const bounds = details.getBoundingClientRect();
      const styles = getComputedStyle(details);
      const endHeight = open ? bounds.height
        : summary.getBoundingClientRect().bottom - bounds.top
          + parseFloat(styles.paddingBottom) + parseFloat(styles.borderBottomWidth);

      details.style.overflow = 'hidden';
      details.dataset.transitionState = open ? 'opening' : 'closing';
      animation = details.animate([
        {height: `${startHeight}px`},
        {height: `${endHeight}px`}
      ], {duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)'});
      const current = animation;
      current.onfinish = () => {
        if (animation === current) finish(open);
      };
    }

    summary.addEventListener('click', event => {
      if (event.defaultPrevented || reducedMotion.matches || !details.animate) return;
      event.preventDefault();
      transition(!targetOpen);
    });
    // Enter and Space generate native summary clicks, so no extra keyboard handler is needed.
    details.addEventListener('toggle', () => {
      if (!animation) targetOpen = details.open;
    });
    const settleOnResize = () => {
      const width = details.getBoundingClientRect().width;
      if (width !== previousWidth) {
        previousWidth = width;
        if (animation) finish(targetOpen);
      }
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(settleOnResize).observe(details);
    } else {
      addEventListener('resize', settleOnResize);
    }
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches && animation) finish(targetOpen);
    });
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) resultEntrance?.cancel();
  });

  // Native scrolling and CSS scroll snap also support touch and trackpads.
  $$('[data-carousel]').forEach(carousel => {
    const track = $('.carousel-track', carousel);
    if (!track) return;

    const slides = [...track.children].filter(child => child.matches('.carousel-slide'));
    if (!slides.length) return;

    const previous = $('[data-carousel-prev]', carousel);
    const next = $('[data-carousel-next]', carousel);
    const status = $('[data-carousel-status]', carousel);
    const dots = $$('[data-carousel-dot]', carousel);
    let currentIndex = 0;
    let requestedIndex = null;
    let updateScheduled = false;
    let lastWidth = track.clientWidth;

    function slidePosition(slide) {
      const inset = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      const position = track.scrollLeft + slide.getBoundingClientRect().left
        - track.getBoundingClientRect().left - track.clientLeft - inset;
      return Math.max(0, Math.min(position, track.scrollWidth - track.clientWidth));
    }

    function updateCarousel() {
      updateScheduled = false;
      const positions = slides.map(slidePosition);
      currentIndex = positions.reduce((nearest, position, index) => (
        Math.abs(position - track.scrollLeft) < Math.abs(positions[nearest] - track.scrollLeft)
          ? index : nearest
      ), 0);

      if (requestedIndex !== null && Math.abs(positions[requestedIndex] - track.scrollLeft) < 1) {
        requestedIndex = null;
      }
      const label = `${currentIndex + 1} / ${slides.length}`;
      if (status && status.textContent !== label) status.textContent = label;
      if (previous) previous.disabled = currentIndex === 0;
      if (next) next.disabled = currentIndex === slides.length - 1;
      dots.forEach((dot, index) => {
        const slideIndex = Number(dot.dataset.carouselDot || index);
        const selected = slideIndex === currentIndex;
        dot.setAttribute('aria-current', String(selected));
        dot.classList.toggle('is-active', selected);
      });
    }

    function scheduleUpdate() {
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(updateCarousel);
      }
    }

    function goTo(index, behavior = reducedMotion.matches ? 'instant' : 'smooth') {
      requestedIndex = Math.max(0, Math.min(index, slides.length - 1));
      track.scrollTo({left: slidePosition(slides[requestedIndex]), behavior});
      scheduleUpdate();
    }

    function navigate(delta) {
      goTo((requestedIndex ?? currentIndex) + delta);
    }

    previous?.addEventListener('click', () => navigate(-1));
    next?.addEventListener('click', () => navigate(1));
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => goTo(Number(dot.dataset.carouselDot || index)));
    });
    track.addEventListener('scroll', scheduleUpdate, {passive: true});
    track.addEventListener('scrollend', () => {
      requestedIndex = null;
      scheduleUpdate();
    });
    ['pointerdown', 'touchstart', 'wheel'].forEach(type => {
      track.addEventListener(type, () => { requestedIndex = null; }, {passive: true});
    });
    track.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

      let destination;
      const active = requestedIndex ?? currentIndex;
      if (event.key === 'ArrowLeft') destination = active - 1;
      if (event.key === 'ArrowRight') destination = active + 1;
      if (event.key === 'Home') destination = 0;
      if (event.key === 'End') destination = slides.length - 1;
      if (destination !== undefined) {
        event.preventDefault();
        goTo(destination);
      }
    });

    function handleResize() {
      if (track.clientWidth !== lastWidth) {
        lastWidth = track.clientWidth;
        goTo(currentIndex, 'instant');
      }
      scheduleUpdate();
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(handleResize).observe(track);
    } else {
      addEventListener('resize', handleResize);
    }
    updateCarousel();
  });

  // Lightboxes read their title, image, and caption from the visible figure.
  const dialog = $('#figure-dialog');
  let lastFigureTrigger;

  function openFigure(trigger) {
    const figure = trigger.closest('.paper-figure, .carousel-slide');
    const source = figure && $('img', figure);
    if (!source || !dialog) return;

    const title = figure.dataset.figureTitle || source.alt;
    const label = figure.dataset.figureLabel || $('.figure-ref', figure)?.textContent.trim() || '';
    const description = figure.matches('.carousel-slide')
      ? '' : $('figcaption', figure)?.textContent.trim() || '';
    const fullResolution = source.getAttribute('src').replace('-1600.webp', '-2400.webp');
    const descriptionElement = $('#lightbox-description');

    lastFigureTrigger = trigger;
    $('#lightbox-title').textContent = title;
    $('#lightbox-label').textContent = label;
    descriptionElement.textContent = description;
    descriptionElement.hidden = !description;
    descriptionElement.parentElement.hidden = !description;
    $('#lightbox-image').alt = source.alt;
    $('#lightbox-image').src = fullResolution;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    $('[data-close-lightbox]').focus();
  }

  $$('[data-zoom]').forEach(button => {
    button.addEventListener('click', () => openFigure(button));
  });
  $('[data-close-lightbox]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });
  dialog?.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    lastFigureTrigger?.focus({preventScroll: true});
  });

  // Copy the citation shown in the page, including in local previews.
  let copiedTimeout;
  $('[data-copy-citation]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const citation = $('#bibtex-code').textContent.trim();
    let copied = false;
    try {
      await navigator.clipboard.writeText(citation);
      copied = true;
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = citation;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(textarea);
      textarea.select();
      try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      textarea.remove();
      button.focus();
    }
    clearTimeout(copiedTimeout);
    if (copied) {
      button.classList.add('is-copied');
      button.dataset.copyState = 'success';
      $('span', button).textContent = 'Copied!';
      $('#copy-status').textContent = 'BibTeX citation copied to clipboard.';
      copiedTimeout = setTimeout(() => {
        button.classList.remove('is-copied');
        button.dataset.copyState = '';
        $('span', button).textContent = 'Copy BibTeX';
      }, 2500);
    } else {
      const range = document.createRange();
      range.selectNodeContents($('#bibtex-code'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      $('#copy-status').textContent = 'Citation selected. Use your copy command to copy it.';
      $('span', button).textContent = 'Text selected';
    }
  });

  // Mobile navigation.
  const menuButton = $('[data-menu-toggle]');
  const navLinks = $('#nav-links');

  function closeMenu() {
    if (!navLinks || !menuButton) return;
    navLinks.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  }

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navLinks.classList.toggle('is-open', open);
  });
  if (navLinks) $$('a', navLinks).forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navLinks?.classList.contains('is-open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.nav-shell')) closeMenu();
  });
  matchMedia('(min-width: 701px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  // Reading progress and the current section indicator.
  const progress = $('.reading-progress span');
  let scrollScheduled = false;

  function updateProgress() {
    if (progress) {
      const total = document.documentElement.scrollHeight - innerHeight;
      const fraction = total > 0 ? Math.min(1, Math.max(0, scrollY / total)) : 0;
      progress.style.transform = `scaleX(${fraction})`;
    }
    scrollScheduled = false;
  }

  addEventListener('scroll', () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      requestAnimationFrame(updateProgress);
    }
  }, {passive: true});
  addEventListener('resize', updateProgress);
  updateProgress();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('.nav-links a').forEach(link => {
          link.classList.toggle('is-current', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, {rootMargin: '-15% 0px -65% 0px'});
    $$('main section[id]').forEach(section => observer.observe(section));
  }
})();
