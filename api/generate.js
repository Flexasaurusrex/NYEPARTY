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
    
    // Build prompt with chaotic spirit entity energy
    const prompt = `Create a single "Party Puff" — a mischievous spirit-ball embodiment of chaotic New Year's Eve energy.

CONCEPT:
Party Puffs are NOT mascots and NOT polite characters.
They are chaotic NYE spirit entities — playful, unhinged, slightly dangerous, and having WAY too much fun.
Think: Tarantino's "Four Rooms" energy in puffball spirit form.

STYLE:
- Round, soft, puffball creature
- Cartoon / illustrated (not realistic)
- Bold outlines, expressive shapes
- High-contrast, cinematic lighting
- Sticker-readable at small sizes

COLOR RULE (CRITICAL — MUST FOLLOW):
The Party Puff's PRIMARY body color MUST be ${primaryColor}.
Secondary details must be lighter/darker variations of ${primaryColor} or use ${secondaryColor}.
Accent sparks and highlights can use ${accentColor}.
Color connection to the source PFP must be obvious at a glance.
NO unrelated palettes. The puff MUST be ${primaryColor}.

SPECIES / VIBE CUE:
This is a ${speciesCue} — a chaotic spirit entity with that vibe.

ENERGY & BEHAVIOR (MOST IMPORTANT):
The Party Puff is mid-chaos.
It is NOT standing still or posing for a photo.
Acceptable behavior:
- mid-jump, slightly out of control
- leaning backward while fireworks misfire
- spinning, bouncing, or careening through the frame
- tripping, flailing, or launching something dangerous-fun
- clearly caught in a chaotic NYE moment

POSE:
- Asymmetrical
- Off-balance
- Dynamic
- Captured mid-action

EXPRESSION:
- Wild, mischievous, overexcited
- Open-mouth laughter, yelling, or manic grin
- Eyes wide, sparkling, or slightly uneven from motion
- NOT calm
- NOT polite
- NOT "hello friend" energy

NYE CHAOS ELEMENTS:
- Fireworks exploding unevenly or sideways
- Confetti flying chaotically (not evenly)
- One prop malfunctioning or crooked (hat slipping, sparkler too close)
- Visual motion cues: sparks, trails, bursts

BACKGROUND:
- Simple but cinematic
- Implies noise, motion, and chaos
- Fireworks, sparks, light bursts
- No detailed scenery

COMPOSITION RULES:
- Slightly off-center framing
- Clear silhouette
- Feels like a frame pulled from a chaotic NYE scene
- NOT symmetrical
- NOT static

The body MUST be ${primaryColor}. This is critical.

GOAL:
The result should feel like: "A mischievous New Year's Eve spirit who just caused a little bit of trouble — and loved it."`;

    const negativePrompt = `photorealistic, realistic lighting, human anatomy, calm pose, standing neutrally, perfect symmetry, polite smile, generic cute mascot, static, centered, balanced, extra limbs, extra eyes, extra faces, text, logo, watermark, detailed scenery, muted colors, beige, cream, pastel pink unless specified, painterly, sketchy`;

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
