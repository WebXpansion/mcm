import './style.css';
import { PRODUCTS } from './data/products.js';

const FRAME_PATH = '/frames/frame_';
const FRAME_EXTENSION = '.webp';
const FRAME_PADDING = 4;
const FALLBACK_TOTAL_FRAMES = 2256;

// Increase this value for a longer scroll experience.
const SCROLL_PIXELS_PER_FRAME = 35;

// Performance tuning.
const CACHE_LIMIT = 150;
const PRELOAD_BEHIND = 30;
const PRELOAD_AHEAD = 80;

const section = document.querySelector('#frame-section');
const canvas = document.querySelector('#frame-canvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const frameCurrent = document.querySelector('#frame-current');
const copyButton = document.querySelector('#copy-frame');
const productCard = document.querySelector('#product-card');

let totalFrames = FALLBACK_TOTAL_FRAMES;
let currentFrame = 1;
let lastRenderedFrame = 1;
let lastRenderedImage = null;
let ticking = false;
let canvasWidth = 0;
let canvasHeight = 0;
let activeProductId = null;
let productHideTimer = null;

const imageCache = new Map();
const loadingCache = new Map();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const padFrame = (frame) => String(frame).padStart(FRAME_PADDING, '0');
const getFrameSrc = (frame) => `${FRAME_PATH}${padFrame(frame)}${FRAME_EXTENSION}`;



async function loadMeta() {
  try {
    const response = await fetch('/frames/meta.json', { cache: 'force-cache' });
    if (!response.ok) return;

    const meta = await response.json();
    if (Number.isFinite(meta.totalFrames)) totalFrames = meta.totalFrames;
  } catch (error) {
    console.warn('Frame metadata could not be loaded. Using fallback total frames.', error);
  }
}

function touchCache(frame, image) {
  if (imageCache.has(frame)) imageCache.delete(frame);
  imageCache.set(frame, image);

  while (imageCache.size > CACHE_LIMIT) {
    const oldestFrame = imageCache.keys().next().value;
    imageCache.delete(oldestFrame);
  }
}

function loadFrame(frame) {
  const safeFrame = clamp(frame, 1, totalFrames);

  if (imageCache.has(safeFrame)) {
    const image = imageCache.get(safeFrame);
    touchCache(safeFrame, image);
    return Promise.resolve(image);
  }

  if (loadingCache.has(safeFrame)) return loadingCache.get(safeFrame);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = getFrameSrc(safeFrame);

    const done = () => {
      touchCache(safeFrame, image);
      loadingCache.delete(safeFrame);
      resolve(image);
    };

    if (image.decode) {
      image.decode().then(done).catch(() => {
        if (image.complete) done();
        else reject(new Error(`Unable to decode frame ${safeFrame}`));
      });
    } else {
      image.onload = done;
      image.onerror = reject;
    }
  });

  loadingCache.set(safeFrame, promise);
  return promise;
}

function preloadAround(frame) {
  loadFrame(frame).then((image) => {
    if (frame === currentFrame) drawFrame(image, frame);
  }).catch(() => {});

  for (let offset = 1; offset <= PRELOAD_AHEAD; offset += 1) {
    const nextFrame = frame + offset;
    if (nextFrame <= totalFrames && !imageCache.has(nextFrame)) loadFrame(nextFrame).catch(() => {});
  }

  for (let offset = 1; offset <= PRELOAD_BEHIND; offset += 1) {
    const previousFrame = frame - offset;
    if (previousFrame >= 1 && !imageCache.has(previousFrame)) loadFrame(previousFrame).catch(() => {});
  }
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvasWidth = width;
  canvasHeight = height;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  setScrollLength();
  if (lastRenderedImage) drawFrame(lastRenderedImage, lastRenderedFrame);
}

function drawFrame(image, frame) {
  if (!image || !image.naturalWidth || !image.naturalHeight) return;

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  let drawWidth;
  let drawHeight;
  let drawX;
  let drawY;

  // cover behavior: the frame always fills the viewport.
  if (imageRatio > canvasRatio) {
    drawHeight = canvasHeight;
    drawWidth = drawHeight * imageRatio;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  } else {
    drawWidth = canvasWidth;
    drawHeight = drawWidth / imageRatio;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  lastRenderedFrame = frame;
  lastRenderedImage = image;
}

function setScrollLength() {
  const scrollLength = Math.max(window.innerHeight * 2, totalFrames * SCROLL_PIXELS_PER_FRAME);
  section.style.height = `${window.innerHeight + scrollLength}px`;
}

function getScrollProgress() {
  const sectionTop = section.offsetTop;
  const availableScroll = section.offsetHeight - window.innerHeight;
  const rawProgress = (window.scrollY - sectionTop) / availableScroll;
  return clamp(rawProgress, 0, 1);
}

function getFrameFromProgress(progress) {
  return clamp(Math.round(progress * (totalFrames - 1)) + 1, 1, totalFrames);
}

function getActiveProduct(frame) {
  return PRODUCTS.find((product) => frame >= product.startFrame && frame <= product.endFrame);
}

function getProductState(product, frame) {
  const entryEnd = product.startFrame + (product.entryFrames ?? 12);
  const exitStart = product.endFrame - (product.exitFrames ?? 14);

  if (frame < entryEnd) return 'entering';
  if (frame > exitStart) return 'exiting';
  return 'visible';
}

function renderProduct(product) {
  const colors = product.colors.map((color, index) => {
    const isActive = index === product.activeColor;
    return `
      <button
        class="color-diamond${isActive ? ' is-active' : ''}"
        style="--diamond-color: ${color.hex};"
        type="button"
        aria-label="${color.name}${isActive ? ' selected' : ''}"
      >
        <span></span>
      </button>
    `;
  }).join('');

  productCard.innerHTML = `
    <div class="product-media">
      <img src="${product.image}" alt="${product.title}" draggable="false" />
    </div>

    <div class="product-content">
      <h2>${product.title}</h2>
      <div class="product-colors" aria-label="Available colors">
        ${colors}
      </div>
    </div>

    <button class="product-buy" type="button">
      <span>Buy</span>
      <em>·</em>
      <span>${product.price}$</span>
    </button>
  `;
}

function updateProductUI(frame) {
  const product = getActiveProduct(frame);

  if (!product) {
    if (activeProductId !== null) {
      productCard.className = 'product-card is-out';
      activeProductId = null;

      window.clearTimeout(productHideTimer);
      productHideTimer = window.setTimeout(() => {
        if (activeProductId === null) {
          productCard.className = 'product-card is-hidden';
          productCard.innerHTML = '';
        }
      }, 520);
    }
    return;
  }

  if (activeProductId !== product.id) {
    window.clearTimeout(productHideTimer);
    activeProductId = product.id;
    renderProduct(product);
  }

  const state = getProductState(product, frame);
  productCard.className = `product-card is-active is-${state}`;
}

function updateFrameDebug(frame) {
  frameCurrent.textContent = padFrame(frame);
}

function updateScrollState() {
  document.body.classList.toggle('has-scrolled', window.scrollY > 8);
}

function renderByScroll() {
  ticking = false;

  const progress = getScrollProgress();
  const nextFrame = getFrameFromProgress(progress);

  updateScrollState();

  if (nextFrame === currentFrame) return;

  currentFrame = nextFrame;
  updateFrameDebug(currentFrame);
  updateProductUI(currentFrame);

  const image = imageCache.get(currentFrame);
  if (image) drawFrame(image, currentFrame);
  else if (lastRenderedImage) drawFrame(lastRenderedImage, lastRenderedFrame);

  preloadAround(currentFrame);
}

function requestRender() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(renderByScroll);
}

function bindEvents() {
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => {
    resizeCanvas();
    requestRender();
  }, { passive: true });

  copyButton.addEventListener('click', async () => {
    const value = String(currentFrame);
    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => { copyButton.textContent = 'Copy'; }, 900);
    } catch {
      copyButton.textContent = value;
    }
  });
}

async function init() {
  await loadMeta();
  setScrollLength();
  resizeCanvas();
  updateFrameDebug(currentFrame);
  updateProductUI(currentFrame);
  bindEvents();

  const firstImage = await loadFrame(1);
  drawFrame(firstImage, 1);
  preloadAround(1);
  requestRender();
}

init();
