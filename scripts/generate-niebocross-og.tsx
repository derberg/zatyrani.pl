import React from 'react'
import fs from 'fs'
import path from 'path'
import url from 'url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Load SVG logo and convert to data URI
function getLogoDataUri() {
  const logoPath = path.join(__dirname, '../public/niebocross_logo.svg')
  const svgContent = fs.readFileSync(logoPath, 'utf-8')
  // Encode SVG as data URI
  const base64Svg = Buffer.from(svgContent).toString('base64')
  return `data:image/svg+xml;base64,${base64Svg}`
}

// Load Klinika logo (convert WebP to PNG for Satori compatibility)
async function getKlinikaLogoDataUri() {
  const logoPath = path.join(__dirname, '../public/niebocross/klinika.webp')
  const pngBuffer = await sharp(logoPath).png().toBuffer()
  const base64Image = pngBuffer.toString('base64')
  return `data:image/png;base64,${base64Image}`
}

// Load OTOZ Animals logo
function getOtozLogoDataUri() {
  const logoPath = path.join(__dirname, '../public/niebocross/otoz.svg')
  const svgContent = fs.readFileSync(logoPath, 'utf-8')
  const base64Svg = Buffer.from(svgContent).toString('base64')
  return `data:image/svg+xml;base64,${base64Svg}`
}

const imageSize = {
  width: 1200,
  height: 630,
}

const NieboCrossImage = ({
  logoDataUri,
  klinikaLogoDataUri,
  otozLogoDataUri
}: {
  logoDataUri: string
  klinikaLogoDataUri: string
  otozLogoDataUri: string
}) => {
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

      {/* Content Container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '60px 80px',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Column - Text Content & Partners */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            paddingRight: '60px',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          {/* Main Event Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
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
              marginBottom: '32px',
              alignSelf: 'center',
            }}
          >
            WYDARZENIE CHARYTATYWNE
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: '80px',
              fontWeight: 700,
              marginBottom: '16px',
              textShadow: '0 4px 20px rgba(0,0,0,0.4)',
              lineHeight: 1,
            }}
          >
            NieboCross
          </div>

          {/* Memorial Text */}
          <div
            style={{
              display: 'flex',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '24px',
              fontWeight: 400,
              fontStyle: 'italic',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              marginBottom: '40px',
            }}
          >
            Pamięci Marka Nowakowskiego
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: 'flex',
              color: 'rgba(255, 255, 255, 0.95)',
              fontSize: '26px',
              fontWeight: 600,
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              marginBottom: '20px',
            }}
          >
            12.04.2026 · Nieborowice
          </div>

          {/* Categories */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '22px',
              fontWeight: 400,
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex' }}>
              3 km & 9 km · Bieg · Nordic Walking
            </div>
            <div style={{ display: 'flex', fontSize: '20px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Bieg dla Dzieci
            </div>
          </div>
          </div>

          {/* Partners Section - Left Column Only */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '16px',
              paddingTop: '30px',
              justifyContent: 'center',
            }}
          >
            {/* Klinika Nieborowice */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  marginBottom: '10px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '240px',
                }}
              >
                <img
                  src={klinikaLogoDataUri}
                  width={240}
                  height={85}
                  style={{
                    width: '240px',
                    height: '85px',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                }}
              >
                Partner Główny Wydarzenia
              </div>
            </div>

            {/* OTOZ Animals */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  marginBottom: '10px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '240px',
                }}
              >
                <img
                  src={otozLogoDataUri}
                  width={200}
                  height={85}
                  style={{
                    width: '200px',
                    height: '85px',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textAlign: 'center',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex' }}>Dochód trafi do</div>
                <div style={{ display: 'flex' }}>OTOZ Animals Inspektorat Gliwice</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Logo Only */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Logo Container with Frame */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '380px',
              height: '380px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '30px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              padding: '30px',
            }}
          >
            <img
              src={logoDataUri}
              width={320}
              height={320}
              style={{
                width: '320px',
                height: '320px',
              }}
            />
          </div>
        </div>
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
    // Load logos as data URIs
    const logoDataUri = getLogoDataUri()
    const klinikaLogoDataUri = await getKlinikaLogoDataUri()
    const otozLogoDataUri = getOtozLogoDataUri()
    console.log('✅ Logos loaded\n')

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
      <NieboCrossImage
        logoDataUri={logoDataUri}
        klinikaLogoDataUri={klinikaLogoDataUri}
        otozLogoDataUri={otozLogoDataUri}
      />,
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
