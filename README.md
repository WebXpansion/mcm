# MCM Scroll Frame Experience

Projet VS Code / Vercel prêt à déployer.

## Included

- 2256 frames extracted from `site.mov` at 30 fps
- WebP frames in `public/frames/`
- Sticky canvas full viewport
- Scroll-driven frame animation
- Animated luxury header: square / line / logo / line / square
- Product card UI driven by frame ranges
- Test product visible from frame `30` to frame `200`
- Current frame debug UI with copy button
- Luxury scroll indicator at the bottom, blurred out after scroll starts
- Mobile fallback: `Experience available on desktop for now`

## Local setup

```bash
npm install
npm run dev
```

## Vercel build

```bash
npm run build
```

Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`

## Product database

Products are managed in:

```txt
src/data/products.js
```

Example:

```js
{
  id: 'liz-shopper-visetos',
  startFrame: 30,
  endFrame: 200,
  title: 'NEW LIZ SHOPPER IN VISETOS',
  price: '780.00',
  image: '/products/liz-shopper.webp',
  activeColor: 0,
  colors: [
    { name: 'Powder', hex: '#e6d2cc' },
    { name: 'Black', hex: '#151515' },
    { name: 'Cognac', hex: '#b45b24' },
    { name: 'Blue', hex: '#16228f' }
  ]
}
```

To show nothing between two products, simply leave a gap between `endFrame` and the next `startFrame`.

## Replace assets

- Logo: `public/brand/mcm-logo.svg`
- Product images: `public/products/`

## Regenerate frames with ffmpeg

Place your video at the root, then run:

```bash
bash scripts/extract-frames.sh site.mov public/frames
```

Custom export:

```bash
FPS=30 WIDTH=1920 QUALITY=70 bash scripts/extract-frames.sh site.mov public/frames
```

Current optimized export:

- FPS: `30`
- Width: `1280`
- WebP quality: `65`
- Compression level: `0`
