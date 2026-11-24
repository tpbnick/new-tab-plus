const lightbox = document.getElementById('lightbox');
const lightboxDialog = lightbox?.querySelector('.lightbox__dialog');
const lightboxImg = lightbox?.querySelector('.lightbox__image');
const lightboxCaption = lightbox?.querySelector('.lightbox__caption');
const lightboxCounter = lightbox?.querySelector('.lightbox__counter');
const prevBtn = lightbox?.querySelector('.lightbox__nav--prev');
const nextBtn = lightbox?.querySelector('.lightbox__nav--next');

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const slides = [...document.querySelectorAll('.screenshot img')].map((img) => ({
  src: img.currentSrc || img.src,
  alt: img.alt,
  caption: img.closest('.screenshot')?.querySelector('figcaption')?.textContent?.trim() ?? '',
}));

let currentIndex = 0;
let lastFocus = null;
let isOpen = false;
let rafId = 0;
let swapTimerId = 0;
let closeFallbackTimerId = 0;
let pendingCloseHandler = null;

function wrapIndex(index) {
  if (!slides.length) return 0;
  return (index + slides.length) % slides.length;
}

function cancelPendingTimers() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (swapTimerId) {
    clearTimeout(swapTimerId);
    swapTimerId = 0;
  }
}

function clearPendingClose() {
  if (pendingCloseHandler && lightbox) {
    lightbox.removeEventListener('transitionend', pendingCloseHandler);
    pendingCloseHandler = null;
  }
  if (closeFallbackTimerId) {
    clearTimeout(closeFallbackTimerId);
    closeFallbackTimerId = 0;
  }
}

function getFocusableElements() {
  if (!lightboxDialog) return [];
  return [
    ...lightboxDialog.querySelectorAll(
      'button:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => el instanceof HTMLElement && !el.closest('[hidden]'));
}

function updateSlide(direction = 0) {
  if (!lightboxImg || !slides.length) return;

  if (swapTimerId) {
    clearTimeout(swapTimerId);
    swapTimerId = 0;
  }

  const slide = slides[currentIndex];

  if (lightboxCounter) {
    lightboxCounter.textContent = `${currentIndex + 1} / ${slides.length}`;
  }

  if (lightboxCaption) {
    const text = slide.caption;
    lightboxCaption.textContent = text;
    lightboxCaption.hidden = !text;
  }

  const applyImage = () => {
    lightboxImg.src = slide.src;
    lightboxImg.alt = slide.alt;
    lightboxImg.classList.remove('is-changing');
  };

  if (prefersReducedMotion() || !direction || !isOpen) {
    applyImage();
    return;
  }

  lightboxImg.classList.add('is-changing');
  swapTimerId = window.setTimeout(() => {
    swapTimerId = 0;
    applyImage();
  }, 120);
}

function openLightbox(index) {
  if (!lightbox || !lightboxImg || !slides.length) return;

  clearPendingClose();
  cancelPendingTimers();

  currentIndex = wrapIndex(index);
  if (!isOpen) {
    lastFocus = document.activeElement;
  }
  isOpen = true;
  updateSlide();

  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');

  if (prefersReducedMotion()) {
    lightbox.classList.add('is-open');
  } else {
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (isOpen) lightbox.classList.add('is-open');
    });
  }

  lightbox.querySelector('.lightbox__close')?.focus();
}

function closeLightbox() {
  if (!isOpen || !lightbox || !lightboxImg) return;

  clearPendingClose();
  cancelPendingTimers();

  isOpen = false;
  const wasVisiblyOpen = lightbox.classList.contains('is-open');
  lightbox.classList.remove('is-open');
  document.body.classList.remove('lightbox-open');

  const finish = () => {
    clearPendingClose();
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = '';
    lightboxImg.classList.remove('is-changing');
    if (lightboxCaption) {
      lightboxCaption.textContent = '';
      lightboxCaption.hidden = true;
    }
    if (lightboxCounter) lightboxCounter.textContent = '';
    if (lastFocus instanceof HTMLElement && lastFocus.isConnected) {
      lastFocus.focus();
    }
    lastFocus = null;
  };

  if (prefersReducedMotion() || !wasVisiblyOpen) {
    finish();
    return;
  }

  pendingCloseHandler = (event) => {
    if (event.target !== lightbox) return;
    finish();
  };
  lightbox.addEventListener('transitionend', pendingCloseHandler);
  closeFallbackTimerId = window.setTimeout(finish, 300);
}

function step(direction) {
  if (!isOpen || slides.length < 2) return;
  currentIndex = wrapIndex(currentIndex + direction);
  updateSlide(direction);
}

lightbox?.querySelectorAll('[data-lightbox-close]').forEach((el) => {
  el.addEventListener('click', closeLightbox);
});

prevBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  step(-1);
});

nextBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  step(1);
});

document.addEventListener('keydown', (event) => {
  if (!isOpen) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeLightbox();
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    step(1);
    return;
  }

  if (event.key === 'Tab') {
    const focusable = getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !lightboxDialog?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !lightboxDialog?.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
});

document.querySelectorAll('.screenshot img').forEach((img, index) => {
  const caption = slides[index]?.caption || img.alt || 'screenshot';
  img.setAttribute('tabindex', '0');
  img.setAttribute('role', 'button');
  img.setAttribute('aria-label', `View larger image: ${caption}`);
  img.addEventListener('click', () => openLightbox(index));
  img.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openLightbox(index);
    }
  });
});

if (slides.length < 2) {
  prevBtn?.setAttribute('hidden', '');
  nextBtn?.setAttribute('hidden', '');
}
