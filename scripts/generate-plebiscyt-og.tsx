import React from 'react'
import fs from 'fs'
import path from 'path'
import url from 'url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { PLEBISCYT } from '../src/utils/plebiscyt.js'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const imageSize = {
  width: 1200,
  height: 630,
}

// Plebiscyt for members. Pink -> purple like the page header, logo on the left.
// Dates come from the plebiscyt config, so the image follows it.
const PlebiscytImage = ({ logo }: { logo: string }) => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #ec4899 0%, #c026d3 45%, #7c3aed 100%)',
        position: 'relative',
        alignItems: 'center',
        padding: '60px 80px',
      }}
    >
      {/* Soft light behind the logo */}
      <div
        style={{
          position: 'absolute',
          left: '40px',
          top: '120px',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.35)',
          filter: 'blur(90px)',
        }}
      />

      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 20px 60px rgba(76, 29, 149, 0.45)',
          marginRight: '64px',
          flexShrink: 0,
        }}
      >
        <img src={logo} width={170} height={203} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            background: 'rgba(255, 255, 255, 0.18)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            padding: '10px 22px',
            borderRadius: '24px',
            color: 'white',
            fontSize: '20px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '24px',
          }}
        >
          Głosowanie dla Zatyranych
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: '96px',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-1px',
            textShadow: '0 6px 30px rgba(76, 29, 149, 0.5)',
            marginBottom: '32px',
          }}
        >
          {`PLEBISCYT ${PLEBISCYT.edition}`}
        </div>

        {/* Dates */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            color: 'rgba(255, 255, 255, 0.92)',
            fontSize: '28px',
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex' }}>{`Głosowanie do ${PLEBISCYT.closesLabel}`}</div>
          <div style={{ display: 'flex' }}>{`Gala Zatyranych: ${PLEBISCYT.gala.when}`}</div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: '80px',
          bottom: '36px',
          color: 'rgba(255, 255, 255, 0.75)',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '1px',
        }}
      >
        zatyrani.pl/plebiscyt
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
  console.log('🎨 Generating Plebiscyt OG image...\n')

  try {
    const fonts = await Promise.all([
      loadFont(400),
      loadFont(600),
      loadFont(700),
      loadFont(900),
    ])
    console.log('✅ Fonts loaded\n')

    const logoData = await fs.promises.readFile(path.join(__dirname, '../public/logo.png'))
    const logo = `data:image/png;base64,${logoData.toString('base64')}`

    const svg = await satori(<PlebiscytImage logo={logo} />, {
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

    const outputPath = path.join(__dirname, '../public/plebiscyt_og.jpg')
    await fs.promises.writeFile(outputPath, optimizedBuffer)

    const size = (optimizedBuffer.length / 1024).toFixed(1)
    console.log(`✨ Saved: public/plebiscyt_og.jpg (${size}KB)\n`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
