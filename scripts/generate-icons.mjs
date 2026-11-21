// Génère les PNG de la PWA depuis les SVG de public/icons. Usage : npm run icons
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url))
const icon = await readFile(dir + 'icon.svg')
const maskable = await readFile(dir + 'icon-maskable.svg')
const sky = '#DCEEF4'

const jobs = [
  [icon, 192, 'icon-192.png', false],
  [icon, 512, 'icon-512.png', false],
  [maskable, 512, 'icon-maskable-512.png', true],
  // iOS ignore la transparence et arrondit lui-même : on part de la version pleine.
  [maskable, 180, 'apple-touch-icon-180.png', true],
]

for (const [svg, size, name, opaque] of jobs) {
  let img = sharp(svg, { density: 300 }).resize(size, size)
  if (opaque) img = img.flatten({ background: sky })
  await img.png().toFile(dir + name)
  console.log('✓', name)
}
