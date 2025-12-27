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
    
    // ACTIONS LIST (choose exactly ONE each generation)
    const actions = [
      "popping a confetti cannon mid-blast (confetti burst clearly visible)",
      "spraying champagne everywhere (champagne spray arc clearly visible)",
      "swinging a sparkler like a wand (sparkler trails clearly visible)",
      "tossing streamers aggressively (streamers clearly flying)",
      "riding a tiny rocket firework (small rocket with sparks, puff holding on)",
      "stealing a party hat and wearing it sideways (mischief pose, hat clearly askew)"
    ];
    
    // PROPS LIST (choose exactly ONE each generation)
    const props = [
      "confetti cannon",
      "champagne bottle spraying",
      "sparkler",
      "party hat"
    ];
    
    // Random selection
    const actionChoice = actions[Math.floor(Math.random() * actions.length)];
    
    // Match prop to action
    let propChoice;
    if (actionChoice.includes("confetti cannon")) {
      propChoice = "confetti cannon";
    } else if (actionChoice.includes("champagne")) {
      propChoice = "champagne bottle spraying";
    } else if (actionChoice.includes("sparkler")) {
      propChoice = "sparkler";
    } else if (actionChoice.includes("party hat")) {
      propChoice = "party hat";
    } else if (actionChoice.includes("rocket firework")) {
      propChoice = Math.random() > 0.5 ? "sparkler" : "confetti cannon";
    } else {
      propChoice = props[Math.floor(Math.random() * props.length)];
    }
    
    console.log('Primary color:', primaryColor, '(from', paletteHex[0], ')');
    console.log('Secondary color:', secondaryColor, '(from', paletteHex[1], ')');
    console.log('Accent color:', accentColor, '(from', paletteHex[2], ')');
    
    // Add random NYE activity selection
    const activities = [
      "popping a champagne bottle with spray everywhere",
      "throwing confetti up in the air with both arms raised",
      "blowing a party horn aggressively",
      "holding sparklers in both hands with trails of light",
      "dancing wildly with streamers flying",
      "jumping in celebration with fireworks behind",
      "wearing stacked party hats that are falling off",
      "holding a 'HAPPY NEW YEAR' banner and cheering",
      "riding on top of a giant champagne cork",
      "juggling party poppers mid-explosion"
    ];
    
    const selectedActivity = activities[Math.floor(Math.random() * activities.length)];
    console.log('Selected NYE activity:', selectedActivity);
    
    // Prompt with FORCED ACTION at the top
    const prompt = `NYE ACTION (CRITICAL - MUST SHOW THIS):
The Party Puff is actively ${selectedActivity}.
Show dynamic motion, NOT a static pose. The character MUST be mid-action with movement visible.

Create a single cute 'Party Puff' mascot character celebrating New Year's Eve.

The character must be a ${speciesCue} with a simple, round, chubby body and clean cartoon style.

COLOR RULES (STRICT - USE THE ACTUAL COLORS):
- The body color MUST be ${primaryColor}. If the color is dark (brown, black, navy), use that dark color for the body.
- Secondary details MUST use ${secondaryColor}.
- Small accents ONLY may use ${accentColor}.
- Do NOT default to white, cream, or beige unless those are the specified colors.
- Do NOT introduce any new dominant colors.
- The Party Puff should clearly match the color vibe of the source (dark colors stay dark, bright colors stay bright).

STYLE RULES:
- Flat-shaded, soft gradients only.
- Smooth outlines.
- No realism, no painterly texture, no fur unless explicitly implied by the species cue.
- Exactly two eyes.
- One mouth (open in excitement/celebration).
- Dynamic pose showing action.

NYE BIG ENERGY:
- High-energy celebration
- Motion lines, sparkles, confetti actively flying
- Fireworks, champagne spray, or party effects clearly visible
- The character should look like they're having the time of their life
- NOT calm, NOT standing still, NOT just posing

COMPOSITION:
- Centered character mid-action
- 1:1 aspect ratio
- High clarity
- Celebratory background with NYE elements (fireworks, lights, bokeh)

The colors MUST match the uploaded image's vibe.`;

    const negativePrompt = `standing still, static pose, calm, neutral expression, just standing, not moving, no action, photorealistic, realistic lighting, painterly, sketchy, messy lines, extra eyes, extra faces, multiple characters, complex background, text, logo, watermark, signature, horror, creepy, distorted anatomy, muted colors, random colors, neon unless specified, gradients that overpower the character, rosy cheeks, pink cheek circles`;

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
