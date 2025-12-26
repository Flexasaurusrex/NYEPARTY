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

    // Build prompt with extracted palette and species cue
    const palette = paletteHex.join(", ");
    
    const prompt = `Create a single, ultra-cute New Year's Eve mascot character called a ${speciesCue}. The mascot is a round, soft, chubby 'puff' creature with clean cartoon linework, simple shapes, and exactly TWO eyes. It must feel like an irresistible sticker / avatar icon.

CRITICAL COLOR MATCHING: Use this exact palette derived from the user's PFP as the ONLY main colors: ${palette}. Apply it like this:
- Primary body color = first palette color
- Secondary accents (cheeks, spots, belly, outline accents) = second palette color
- Accessories (party hat/noisemaker/bowtie) = third palette color
- Sparkles/confetti/highlight glows = fourth palette color (if provided)
Do NOT introduce random new dominant colors outside the palette.

NYE PARTY ENERGY: Add high 'razzamatazz' celebration elements around the mascot: confetti burst, glitter sparkles, small fireworks twinkles, bokeh light orbs, festive glow halo, and one fun party prop (party hat or party blower). Make it feel like the mascot is celebrating New Year's Eve HARD — joyful, festive, iconic.

STYLE: clean 2D cartoon mascot, smooth shading, crisp outlines, high polish, centered composition, 1:1 square avatar, simple background (subtle gradient or soft bokeh) that also respects the palette.

HARD CONSTRAINTS:
- exactly two eyes
- no extra faces, no extra limbs, no uncanny details
- no realistic human portrait
- no text, no letters, no numbers
- no gore, no creepy, no nightmare fuel
- keep it cute, friendly, and clean`;

    const negativePrompt = `photorealistic, realistic, human, portrait, uncanny, horror, creepy, nightmare, extra eyes, multiple faces, deformed, mutated, extra limbs, hands, fingers, teeth close-up, gore, blood, text, letters, numbers, watermark, logo, messy lines, lowres, blurry, grainy, bad anatomy, disproportionate features`;

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
