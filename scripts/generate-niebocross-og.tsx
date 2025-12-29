import React from 'react'
import fs from 'fs'
import path from 'path'
import url from 'url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const imageSize = {
  width: 1200,
  height: 630,
}

const NieboCrossImage = () => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0c4a6e 0%, #1e293b 50%, #047857 100%)',
        position: 'relative',
      }}
    >
      {/* Glow effects */}
      <div
        style={{
          position: 'absolute',
          left: '240px',
          top: '120px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(94, 234, 212, 0.15)',
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '240px',
          bottom: '120px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.18)',
          filter: 'blur(60px)',
        }}
      />
      
      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '12px 24px',
            borderRadius: '24px',
            color: '#6ee7b7',
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            marginBottom: '20px',
          }}
        >
          WYDARZENIE CHARYTATYWNE
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: '72px',
            fontWeight: 900,
            marginBottom: '20px',
            textShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          NieboCross
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '24px',
            fontWeight: 500,
            textShadow: '0 2px 10px rgba(0,0,0,0.3)',
            marginBottom: '16px',
          }}
        >
          12.04.2026 · Nieborowice · 3 km & 9 km
        </div>

        {/* Categories */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '20px',
            fontWeight: 400,
            textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        >
          Bieg · Nordic Walking · Bieg dla dzieci
        </div>
      </div>
    </div>
  )
}

async function loadFont(weight: 400 | 700) {
  // Try common system font paths
  const possiblePaths = [
    `/System/Library/Fonts/Supplemental/Arial ${weight === 700 ? 'Bold' : ''}.ttf`,
    `/usr/share/fonts/truetype/liberation/LiberationSans-${weight === 700 ? 'Bold' : 'Regular'}.ttf`,
    path.join(__dirname, `../node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`),
  ]

  for (const fontPath of possiblePaths) {
    if (fs.existsSync(fontPath)) {
      const data = await fs.promises.readFile(fontPath)
      return {
        name: 'Inter',
        data: data.buffer as ArrayBuffer,
        weight,
        style: 'normal' as const,
      }
    }
  }

  // Fallback: use a basic sans-serif
  throw new Error('No suitable font found. Please install @fontsource/inter')
}

async function main() {
  console.log('🎨 Generating NieboCross OG image...\n')

  try {
    // Load fonts
    const fonts = await Promise.all([loadFont(400), loadFont(700)])
    console.log('✅ Fonts loaded\n')

    // Generate SVG
    const svg = await satori(<NieboCrossImage />, {
      width: imageSize.width,
      height: imageSize.height,
      fonts,
    })

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
