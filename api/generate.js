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
    
    // ACTIONS array (choose exactly one)
    const actions = [
      "Popping a confetti cannon mid-blast (confetti visibly exploding outward)",
      "Spraying champagne everywhere (champagne spray arc clearly visible)",
      "Swinging a sparkler like a wand (sparkler trail visible)",
      "Tossing streamers aggressively (streamers flying in motion)",
      "Riding a tiny rocket firework (small rocket under/behind puff with motion lines)",
      "Stealing a party hat and wearing it sideways (mischief pose—hat tilted, smug but still friendly)"
    ];
    
    // PROPS array (choose exactly one)
    const props = [
      "Confetti cannon",
      "Champagne spray bottle",
      "Sparkler",
      "Party hat"
    ];
    
    // Random selection
    const chosenAction = actions[Math.floor(Math.random() * actions.length)];
    
    // Match prop to action for consistency
    let chosenProp;
    if (chosenAction.includes("confetti cannon")) {
      chosenProp = "Confetti cannon";
    } else if (chosenAction.includes("champagne")) {
      chosenProp = "Champagne spray bottle";
    } else if (chosenAction.includes("sparkler")) {
      chosenProp = "Sparkler";
    } else if (chosenAction.includes("party hat")) {
      chosenProp = "Party hat";
    } else if (chosenAction.includes("rocket firework")) {
      chosenProp = Math.random() > 0.5 ? "Sparkler" : "Confetti cannon";
    } else {
      chosenProp = props[Math.floor(Math.random() * props.length)];
    }
    
    console.log('Chosen action:', chosenAction);
    console.log('Chosen prop:', chosenProp);
    
    // FINAL LOCKED PROMPT
    const prompt = `Create a single cute 'Party Puff' mascot character celebrating New Year's Eve.

The character must be a ${speciesCue} with a simple, round, chubby body and clean cartoon style.

COLOR RULES (STRICT):
- The body color MUST be based on ${primaryColor}.
- Secondary details MUST use ${secondaryColor}.
- Small accents ONLY may use ${accentColor}.
- Do NOT introduce any new dominant colors.

STYLE RULES:
- Flat-shaded, soft gradients only.
- Smooth outlines.
- No realism, no painterly texture, no fur unless explicitly implied by the species cue.
- Exactly two eyes.
- One mouth.
- No extra limbs, faces, or features.
- NO circular rosy cheeks / cheek dots / pink cheek patches.

FACE / EXPRESSION (LOCKED):
- Two simple black oval eyes with small white highlights.
- One small open smile mouth (friendly).
- No angry eyebrows, no manic grin, no screaming mouth, no anime eyes.

NYE DETAILS:
- Include EXACTLY ONE prop (active, not decorative): ${chosenProp}.
- Include EXACTLY ONE action (clear, dynamic, readable): ${chosenAction}.
- The prop must be used actively in the action and clearly visible.
- Subtle sparkles or confetti around the character (only if it does not count as an extra prop).
- Clean, sticker-like composition.
- Neutral or soft background that does NOT overpower the character.

COMPOSITION:
- Centered character
- 1:1 aspect ratio
- High clarity, no motion blur
- Friendly, joyful expression (mischief allowed, but still friendly)

IMPORTANT:
This must feel PERSONAL because of the color palette and species cue.
Avoid generic pastel blobs.
Avoid random color choices.
Avoid default "cute mascot" tropes unless they match the given palette.`;

    const negativePrompt = `photorealistic, realistic lighting, painterly, sketchy, messy lines, extra eyes, extra faces, multiple characters, complex background, text, logo, watermark, signature, horror, creepy, distorted anatomy, muted colors, random colors, neon unless specified, gradients that overpower the character, rosy cheeks, cheek blush circles, pink cheek dots, anime eyes, angry eyebrows, screaming mouth, manic grin, extra props, multiple props, decorative props not being used`;

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
