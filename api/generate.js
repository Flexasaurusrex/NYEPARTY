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
    
    // Action/prop arrays with compatibility
    const actions = [
      "popping a confetti cannon mid-blast with chaotic celebratory energy",
      "spraying champagne everywhere like a tiny menace",
      "swinging a sparkler like a magic wand, leaving a glitter trail",
      "aggressively tossing streamers into the air like party chaos",
      "riding a tiny rocket firework with a mischievous grin",
      "stealing a party hat and wearing it sideways like a prankster"
    ];
    
    const props = [
      "confetti cannon",
      "champagne spray",
      "sparkler",
      "party hat"
    ];
    
    // Pick random action
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    // Pick compatible prop based on action
    let prop;
    if (action.includes("confetti cannon")) {
      prop = "confetti cannon";
    } else if (action.includes("champagne")) {
      prop = "champagne spray";
    } else if (action.includes("sparkler")) {
      prop = "sparkler";
    } else if (action.includes("party hat") || action.includes("hat")) {
      prop = "party hat";
    } else if (action.includes("rocket firework")) {
      prop = Math.random() > 0.5 ? "sparkler" : "confetti cannon";
    } else {
      // Fallback: random prop
      prop = props[Math.floor(Math.random() * props.length)];
    }
    
    console.log('Action:', action);
    console.log('Prop:', prop);
    
    // Final optimized prompt
    const prompt = `Create a single cute "Party Puff" mascot character celebrating New Year's Eve.
The character must be a ${speciesCue} with a simple, round, chubby body and clean cartoon style.

COLOR RULES (CRITICAL - FOLLOW EXACTLY):
- The main body color MUST be ${primaryColor}. Make the entire body ${primaryColor}.
- Secondary details and accents MUST use ${secondaryColor}.
- Small highlights ONLY may use ${accentColor}.
- The character should be PRIMARILY ${primaryColor} in color.
- Do NOT introduce any new dominant colors. Do NOT use random pastels or beige unless that is the specified color.

STYLE RULES:
- Stylized video game mascot portrait / character icon.
- Flat-shaded, soft gradients only (clean shading, flat lighting).
- Smooth outlines, bold readable shapes.
- No realism, no painterly texture, no cinematic lighting, no 3D render look.
- Exactly two eyes. One mouth. No extra limbs, faces, or features.

FACE / EXPRESSION (MUST MATCH EXACTLY):
- Eyes: two simple black oval eyes with small white catchlights.
- Mouth: small open smiling mouth (simple curved shape or perfect circle looking surprised) with a tiny red tongue visible.
- NO rosy cheek circles. NO blush marks. NO pink cheek dots. NO makeup.

NYE ACTION + PROP (DYNAMIC, EXACTLY ONE OF EACH):
- ACTION: ${action}
- PROP: ${prop}
The prop must be ACTIVE and part of the action (not decorative).

NYE VIBE DETAILS (SUBTLE):
- Add subtle sparkles OR small confetti bits in the air (minimal, not clutter).
- Clean, sticker-like composition. Simple background that does NOT overpower the character.

COMPOSITION:
- Single character only, centered
- 1:1 aspect ratio
- High clarity, no motion blur

The body MUST be ${primaryColor}. This is the most important rule.`;

    const negativePrompt = `photorealistic, realism, cinematic lighting, dramatic lighting, 3D render, painterly, sketchy, messy lines, fur texture, highly detailed, hyperreal, extra eyes, extra faces, multiple characters, complex background, text, logo, watermark, signature, horror, creepy, distorted anatomy, motion blur, blush, rosy cheeks, pink cheek circles, cheek dots, makeup, random colors, beige, cream, pastel pink, default cute mascot palette, gradients that overpower the character`;

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
