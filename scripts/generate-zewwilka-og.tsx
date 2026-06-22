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

// Nocny Zew Wilka — free night run, prologue to IV Wilczy Półmaraton.
// Night theme matching the landing hero (slate -> emerald), with a moon glow.
const ZewWilkaImage = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #064e3b 100%)',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '70px 80px',
      }}
    >
      {/* Moon glow */}
      <div
        style={{
          position: 'absolute',
          right: '40px',
          top: '20px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(167, 243, 208, 0.25)',
          filter: 'blur(80px)',
        }}
      />
      {/* Moon */}
      <div
        style={{
          position: 'absolute',
          right: '80px',
          top: '60px',
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #fefce8 0%, #fde68a 70%, #facc15 100%)',
          boxShadow: '0 0 60px rgba(250, 204, 21, 0.4)',
        }}
      />
      {/* Forest-floor glow */}
      <div
        style={{
          position: 'absolute',
          left: '120px',
          bottom: '40px',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'rgba(5, 150, 105, 0.25)',
          filter: 'blur(90px)',
        }}
      />

      {/* Badge */}
      <div
        style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(110, 231, 183, 0.35)',
          padding: '10px 24px',
          borderRadius: '24px',
          color: '#6ee7b7',
          fontSize: '20px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: '28px',
        }}
      >
        Rozgrzewka przed IV Wilczym Półmaratonem
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          color: 'white',
          fontSize: '104px',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-1px',
          textShadow: '0 6px 30px rgba(0,0,0,0.5)',
          marginBottom: '28px',
        }}
      >
        NOCNY ZEW WILKA
      </div>

      {/* Date / time / place */}
      <div
        style={{
          display: 'flex',
          color: '#a7f3d0',
          fontSize: '36px',
          fontWeight: 700,
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          marginBottom: '12px',
        }}
      >
        7.08.2026 · 20:00 · Rybnik-Ochojec
      </div>

      {/* Facts */}
      <div
        style={{
          display: 'flex',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '28px',
          fontWeight: 400,
          textShadow: '0 2px 10px rgba(0,0,0,0.35)',
        }}
      >
        Bieg nocny ~10 km · Bezpłatny · Limit 50 miejsc
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          bottom: '36px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '1px',
        }}
      >
        zatyrani.pl
      </div>
    </div>
  )
}

async function loadFont(weight: 400 | 600 | 700 | 900) {
  const fontMappings: Record<number, string> = {
    400: 'Inter-Regular.ttf',
    600: 'Inter-SemiBold.ttf',
    700: 'Inter-Bold.ttf',
    900: 'Inter-Black.ttf',
  }

  const fontPath = path.join(__dirname, '../fonts', fontMappings[weight])
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
  console.log('🎨 Generating Nocny Zew Wilka OG image...\n')

  try {
    const fonts = await Promise.all([
      loadFont(400),
      loadFont(600),
      loadFont(700),
      loadFont(900),
    ])
    console.log('✅ Fonts loaded\n')

    const svg = await satori(<ZewWilkaImage />, {
      width: imageSize.width,
      height: imageSize.height,
      fonts,
    })

    const resvg = new Resvg(svg, {
      background: 'black',
      fitTo: { mode: 'width', value: 1200 },
      font: { loadSystemFonts: false },
    })

    const pngBuffer = resvg.render().asPng()

    const optimizedBuffer = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer()

    const outputPath = path.join(__dirname, '../public/zewwilka_og.jpg')
    await fs.promises.writeFile(outputPath, optimizedBuffer)

    const size = (optimizedBuffer.length / 1024).toFixed(1)
    console.log(`✨ Saved: public/zewwilka_og.jpg (${size}KB)\n`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
