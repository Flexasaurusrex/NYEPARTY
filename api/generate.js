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
    
    // Simple pose variations
    const poses = [
      "holding a sparkler up in the air cheerfully",
      "wearing a party hat and celebrating with arms raised",
      "jumping joyfully with confetti around",
      "waving happily with a big smile",
      "holding a noisemaker and looking excited"
    ];
    const selectedPose = poses[Math.floor(Math.random() * poses.length)];
    
    // Style-locked prompt (matches the working example)
    const prompt = `A cute round Party Puff character celebrating New Year's Eve.

Character is a ${speciesCue}, ${selectedPose}.

STYLE (CRITICAL - LOCK THIS):
Polished digital illustration
Soft gradient shading with rim lighting
Clean cartoon style with depth
Warm orange/yellow rim light on edges
Smooth rounded shapes
Professional game art quality
Like a mobile game character or children's book illustration

CHARACTER DESIGN:
Round teardrop-shaped body
Two large expressive black eyes with white highlights
Wide happy smile
Small simple limbs (arms and feet)
Cute and appealing proportions

COLORS (MUST MATCH):
Primary body color: ${primaryColor}
Secondary/shadow tones: darker ${primaryColor}
Accent highlights: ${accentColor}
Warm rim lighting: orange/yellow glow
Use the exact color palette provided

SCENE & ATMOSPHERE:
New Year's Eve celebration at night
Fireworks bursting in background (gold and colorful)
Confetti falling
Dark blue/purple night sky
Warm festive lighting
Character is clearly lit and stands out

COMPOSITION:
Centered character
Character takes up most of frame
Slight low angle view
Festive background depth
1:1 square format

The result should look polished, professional, and joyful.`;

    const negativePrompt = `flat 2D, vector art, simplistic, minimalist, sketch, rough, messy, photorealistic, 3D render, realistic fur, extra eyes, extra faces, multiple characters, text, watermark, dark mood, scary, ugly, deformed`;

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
