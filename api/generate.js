module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, paletteHex, speciesCue } = req.body;

    if (!image || !paletteHex || !speciesCue) {
      return res.status(400).json({ error: 'Missing required fields: image, paletteHex, speciesCue' });
    }

    console.log('Starting Party Puff generation with FLUX...');
    console.log('Species cue:', speciesCue);
    console.log('Palette:', paletteHex);

    // Convert hex to color names that FLUX understands
    function hexToColorName(hex) {
      const rgb = {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
      };
      
      // Determine color name based on dominant channel
      if (rgb.r < 50 && rgb.g < 50 && rgb.b < 50) return 'black';
      if (rgb.r > 200 && rgb.g > 200 && rgb.b > 200) return 'white';
      
      if (rgb.g > rgb.r && rgb.g > rgb.b) {
        if (rgb.g > 150) return rgb.g > 200 ? 'bright green' : 'green';
        return 'dark green';
      }
      if (rgb.r > rgb.g && rgb.r > rgb.b) {
        if (rgb.r > 150) return 'red';
        return 'dark red';
      }
      if (rgb.b > rgb.r && rgb.b > rgb.g) {
        if (rgb.b > 150) return 'blue';
        return 'dark blue';
      }
      
      // Mixed colors
      if (rgb.r > 150 && rgb.g > 150) return 'yellow';
      if (rgb.r > 150 && rgb.b > 150) return 'pink';
      if (rgb.g > 150 && rgb.b > 150) return 'cyan';
      
      return 'gray';
    }
    
    const primaryColor = hexToColorName(paletteHex[0] || '#FF69B4');
    const secondaryColor = hexToColorName(paletteHex[1] || '#FFD700');
    const accentColor = hexToColorName(paletteHex[2] || '#87CEEB');
    
    console.log('Primary color:', primaryColor, '(from', paletteHex[0], ')');
    console.log('Secondary color:', secondaryColor, '(from', paletteHex[1], ')');
    console.log('Accent color:', accentColor, '(from', paletteHex[2], ')');
    
    // Build prompt with chaotic NYE energy
    const prompt = `Create a New Year's Eve 2026-themed illustration of a cute ${speciesCue} character with simple, clean shapes and friendly proportions.

CHARACTER COLOR (CRITICAL):
- The main body color MUST be ${primaryColor}. Make the entire body ${primaryColor}.
- Secondary details MUST use ${secondaryColor}.
- Maintain the original clean base palette, but add selective contrast spikes with gold accents, silver highlights, and pops of ${accentColor}.
- The character should be PRIMARILY ${primaryColor} in color.

CHARACTER STYLE:
- Simple, round, chubby body with clean cartoon style
- Exactly two eyes
- One mouth
- Smooth outlines
- Flat-shaded with soft gradients

SCENE ENERGY (CHAOTIC AND MESSY):
The character must be actively doing something dumb or overwhelmed. Capture a candid moment in motion, not a clean portrait.

The character is caught mid-action:
* slipping on confetti
* screaming as fireworks go off too close
* struggling to hold accessories that are clearly too large
* desperately dealing with messy NYE chaos

MULTIPLE NYE ACCESSORIES (IMPERFECT AND AWKWARD):
- Crooked or oversized party hat
- Champagne flute that is half-spilled or tipping
- Party poppers mid-explosion
- Stupid novelty sunglasses (stars, "2026", pixel frames)
- Clock showing 12:00 (midnight clearly visible)
- Tiny disco ball (held, dangling, or awkwardly attached)
- Fireworks being held incorrectly or too close
- Confetti stuck to the character, face, and props — NOT floating cleanly

RULE: Nothing should feel centered, symmetrical, balanced, or perfect. Accessories should overlap, tilt, slip, collide, or feel slightly too big. Confetti should cling awkwardly and unevenly.

LIGHTING:
Party lights hitting the character — energetic, celebratory, slightly chaotic. Metallic textures on accessories (gold, silver). Dynamic lighting without overwhelming the core design.

COMPOSITION:
- Off-center, asymmetrical
- Motion and imbalance
- Humor and imperfection over cleanliness
- 1:1 aspect ratio
- Joyful, dumb, slightly unhinged New Year's Eve energy

Overall tone: These should feel like small celebratory objects people buy impulsively because they're funny, relatable, and perfectly imperfect.

The body MUST be ${primaryColor}. This is the most important rule.`;

    const negativePrompt = `photorealistic, realistic lighting, painterly, sketchy, messy lines, extra eyes, extra faces, multiple characters, text, logo, watermark, signature, horror, creepy, distorted anatomy, beige, cream, pastel pink unless specified, random colors, centered composition, symmetrical, balanced, clean portrait, static pose, floating confetti, perfect accessories, minimal scene, boring`;

    // FLUX 1.1 Pro with recommended settings
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-1.1-pro',
        input: {
          prompt: `${prompt}\n\nNegative prompt: ${negativePrompt}`,
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 90,
          safety_tolerance: 2,
          num_outputs: 1,
          guidance: 5, // Slight increase to enforce palette
          num_inference_steps: 32 // Higher for polish
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FLUX API error status:', response.status);
      console.error('FLUX API error response:', errorText);
      return res.status(500).json({ 
        error: `FLUX API error (${response.status})`,
        details: errorText 
      });
    }

    let prediction = await response.json();
    console.log('Prediction created:', prediction.id);
    console.log('Initial status:', prediction.status);

    // Poll for completion
    const maxAttempts = 60;
    let attempts = 0;

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_KEY}`
        }
      });

      prediction = await statusResponse.json();
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`Status check ${attempts}/${maxAttempts}: ${prediction.status}`);
      }
    }

    if (prediction.status === 'failed') {
      console.error('Prediction failed:', prediction.error);
      throw new Error(`Party Puff generation failed: ${prediction.error}`);
    }

    if (prediction.status !== 'succeeded') {
      throw new Error('Party Puff generation timed out');
    }

    console.log('Party Puff generated successfully!');
    const imageData = prediction.output;

    return res.status(200).json({
      imageUrl: imageData,
      success: true
    });

  } catch (error) {
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: error.message || 'Generation failed',
      details: error.stack
    });
  }
}
