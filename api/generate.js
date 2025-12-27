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
    
    // Drop-in replacement prompt (optimized)
    const prompt = `Create a single 'Party Puff' NYE mascot — a mischievous spirit-ball of chaotic New Year's energy (playful troublemaker, not scary).
The character must be a ${speciesCue} with a simple, round, chubby puffball body in a stylized video game mascot portrait style (character icon).

COLOR RULES (CRITICAL - FOLLOW EXACTLY):
- The main body color MUST be ${primaryColor}. Make the entire body ${primaryColor}.
- Secondary details and accents MUST use ${secondaryColor}.
- Small highlights ONLY may use ${accentColor}.
- The character should be PRIMARILY ${primaryColor} in color.
- Do NOT use random pastels, beige, cream, or skin tones unless that is the specified color.

STYLE LOCK (IMPORTANT):
- Stylized video game mascot / character icon.
- Clean shading, flat lighting, bold colors, crisp outlines.
- Simple soft gradients only (no realism, no cinematic lighting, no 3D render look).
- Exactly two eyes. One mouth. No extra faces/eyes/limbs.

MISCHIEF ACTION (CHOOSE ONE SCENE — show clear action, not just posing):
- popping a confetti cannon mid-blast
- spraying champagne everywhere (comedic, messy spray)
- swinging a sparkler like a tiny wand leaving a glitter trail
- tossing party streamers / blowing a party horn aggressively
- riding a tiny rocket firework like a rebel
- stealing the party hat and wearing it sideways like a menace
The expression should read: "mischievous / chaotic fun" (smirk, gremlin grin, playful eyebrow tilt) — NOT angry horror.

NYE PROP ANCHOR (1–2 props max, must be visible and obvious):
- party hat OR sparkler OR confetti cannon OR champagne spray
Include falling confetti and a few sparkle stars.

CHEEKS / FACE:
- NO rosy cheeks, no blush circles. Keep face clean and simple.

COMPOSITION:
- Centered character, full body visible, sticker-like cutout with a clean outline.
- Simple background (single color or subtle gradient) using ${secondaryColor} or a darker shade of ${primaryColor}.
- 1:1 aspect ratio.
- No text.

The body MUST be ${primaryColor}. This is the most important rule.`;

    const negativePrompt = `photorealistic, realism, cinematic lighting, ultra detailed, highly detailed, 3d render, furry realistic creature, creepy, horror, terrifying, angry demon, gore, disturbing,
blush, rosy cheeks, pink cheeks, makeup,
extra eyes, extra faces, multiple characters, complex background, clutter, scenery, room interior,
text, letters, logo, watermark, signature,
beige, cream, pastel, random colors, default colors, skin tones`;

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
