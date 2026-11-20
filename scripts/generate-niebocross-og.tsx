import React from 'react'
import fs from 'fs'
import path from 'path'
import url from 'url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Load the 2027 crane artwork (WebP converted to PNG for Satori compatibility)
async function getCraneDataUri() {
  const cranePath = path.join(__dirname, '../public/niebocross/2027-crane-light.webp')
  const pngBuffer = await sharp(cranePath).resize({ width: 720 }).png().toBuffer()
  return `data:image/png;base64,${pngBuffer.toString('base64')}`
}

const imageSize = {
  width: 1200,
  height: 630,
}

const NieboCrossImage = ({ craneDataUri }: { craneDataUri: string }) => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#16224a',
        position: 'relative',
      }}
    >
      <img
        src={craneDataUri}
        width={700}
        height={707}
        style={{ position: 'absolute', right: '-40px', top: '-30px', width: '700px', height: '707px' }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 70px',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', color: 'white', fontSize: '96px', fontWeight: 900, lineHeight: 1 }}>II NieboCross</div>
        <div style={{ display: 'flex', color: 'white', fontSize: '96px', fontWeight: 900, lineHeight: 1 }}>2027</div>
        <div style={{ display: 'flex', color: '#cdebf7', fontSize: '32px', fontWeight: 400, marginTop: '36px' }}>Pamięci Marka Nowakowskiego</div>
        <div style={{ display: 'flex', color: 'white', fontSize: '32px', fontWeight: 700, marginTop: '12px' }}>18 kwietnia 2027, Nieborowice</div>
      </div>
    </div>
  )
}

async function loadFont(weight: 400 | 600 | 700 | 900) {
  // Map weights to bundled Inter font files (supports Polish characters)
  const fontMappings: Record<number, string> = {
    400: 'Inter-Regular.ttf',
    600: 'Inter-SemiBold.ttf',
    700: 'Inter-Bold.ttf',
    900: 'Inter-Black.ttf',
  }

  const fontFileName = fontMappings[weight]
  const fontPath = path.join(__dirname, '../fonts', fontFileName)

  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file not found: ${fontPath}`)
  }

  const data = await fs.promises.readFile(fontPath)
  return {
    name: 'Inter',
    data: data.buffer as ArrayBuffer,
    weight,
    style: 'normal' as const,
  }
}

async function main() {
  console.log('🎨 Generating NieboCross OG image...\n')

  try {
    const craneDataUri = await getCraneDataUri()
    console.log('✅ Artwork loaded\n')

    // Load fonts with Polish character support
    const fonts = await Promise.all([
      loadFont(400),
      loadFont(600),
      loadFont(700),
      loadFont(900),
    ])
    console.log('✅ Fonts loaded\n')

    // Generate SVG
    const svg = await satori(
      <NieboCrossImage craneDataUri={craneDataUri} />,
      {
        width: imageSize.width,
        height: imageSize.height,
        fonts,
      }
    )

    // Convert to PNG
    const resvg = new Resvg(svg, {
      background: 'black',
      fitTo: {
        mode: 'width',
        value: 1200,
      },
      font: {
        loadSystemFonts: false,
      },
    })

    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    // Optimize
    const optimizedBuffer = await sharp(pngBuffer)
      .jpeg({
        quality: 90,
      })
      .toBuffer()

    // Save
    const outputPath = path.join(__dirname, '../public/niebocross_og.jpg')
    await fs.promises.writeFile(outputPath, optimizedBuffer)

    const size = (optimizedBuffer.length / 1024).toFixed(1)
    console.log(`✨ Saved: public/niebocross_og.jpg (${size}KB)\n`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
