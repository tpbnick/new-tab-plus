const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox?.querySelector('.lightbox__image');
const lightboxCaption = lightbox?.querySelector('.lightbox__caption');
const lightboxCounter = lightbox?.querySelector('.lightbox__counter');
const prevBtn = lightbox?.querySelector('.lightbox__nav--prev');
const nextBtn = lightbox?.querySelector('.lightbox__nav--next');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const slides = [...document.querySelectorAll('.screenshot img')].map((img) => ({
  src: img.currentSrc || img.src,
  alt: img.alt,
  caption: img.closest('.screenshot')?.querySelector('figcaption')?.textContent?.trim() ?? '',
}));

let currentIndex = 0;
let lastFocus = null;
let isOpen = false;

function wrapIndex(index) {
  if (!slides.length) return 0;
  return (index + slides.length) % slides.length;
}

function updateSlide(direction = 0) {
  if (!lightboxImg || !slides.length) return;

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

  if (reduceMotion || !direction || !isOpen) {
    applyImage();
    return;
  }

  lightboxImg.classList.add('is-changing');
  window.setTimeout(applyImage, 120);
}

function openLightbox(index) {
  if (!lightbox || !lightboxImg || !slides.length) return;

  currentIndex = wrapIndex(index);
  lastFocus = document.activeElement;
  isOpen = true;
  updateSlide();

  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');

  if (reduceMotion) {
    lightbox.classList.add('is-open');
  } else {
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
  }

  lightbox.querySelector('.lightbox__close')?.focus();
}

function closeLightbox() {
  if (!lightbox || !lightboxImg) return;

  isOpen = false;
  lightbox.classList.remove('is-open');
  document.body.classList.remove('lightbox-open');

  const finish = () => {
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = '';
    lightboxImg.classList.remove('is-changing');
    if (lightboxCaption) {
      lightboxCaption.textContent = '';
      lightboxCaption.hidden = true;
    }
    if (lightboxCounter) lightboxCounter.textContent = '';
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  if (reduceMotion) {
    finish();
    return;
  }

  lightbox.addEventListener('transitionend', finish, { once: true });
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
  }
});

document.querySelectorAll('.screenshot img').forEach((img, index) => {
  img.addEventListener('click', () => openLightbox(index));
});

if (slides.length < 2) {
  prevBtn?.setAttribute('hidden', '');
  nextBtn?.setAttribute('hidden', '');
}
