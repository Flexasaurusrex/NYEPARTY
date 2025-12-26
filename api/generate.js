// Helper function to extract dominant colors from base64 image
async function extractDominantColors(dataURL) {
  // Convert base64 to buffer and sample colors
  const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Simple color extraction: sample pixels and find most common
  // For a quick implementation, we'll analyze the data pattern
  const colorMap = new Map();
  
  // Sample every Nth byte to get color distribution
  for (let i = 0; i < buffer.length - 2; i += 100) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    
    // Quantize to reduce color space
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    
    const colorKey = `${qr},${qg},${qb}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }
  
  // Get top 4 colors
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([rgb]) => {
      const [r, g, b] = rgb.split(',').map(Number);
      return `rgb(${r}, ${g}, ${b})`;
    });
  
  return {
    primary: sortedColors[0] || 'rgb(100, 200, 100)',
    secondary: sortedColors[1] || 'rgb(200, 100, 150)',
    accent: sortedColors[2] || 'rgb(150, 150, 255)',
    highlight: sortedColors[3] || 'rgb(255, 200, 100)'
  };
}

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
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Missing required field: image' });
    }

    console.log('Starting Party Puff generation with FLUX...');
    console.log('Has REPLICATE_API_KEY:', !!process.env.REPLICATE_API_KEY);

    // Extract colors from uploaded image
    const colors = await extractDominantColors(image);
    console.log('Extracted colors:', colors);

    // PARTY PUFF PROMPT - Optimized for FLUX 1.1 Pro with color injection
    const prompt = `Create a cute, friendly cartoon mascot called a "Party Puff" celebrating New Year's Eve.
The Party Puff MUST follow these rules:
- One round, circular body
- EXACTLY two eyes
- EXACTLY one small mouth
- No nose
- No extra faces
- No extra eyes
- No extra limbs
- Simple, clean silhouette
- Smooth flat colors
- Clear black or dark outline
- Cute, wholesome, sticker-like appearance
The Party Puff is non-human and looks like a modern game or app mascot.
STYLE:
- Clean cartoon illustration
- Vector-style shading
- No texture noise
- No realism
- No painterly brush strokes
- No fur, wrinkles, or organic detail
NEW YEAR'S EVE THEME:
- Colorful confetti floating around
- Sparkles and soft glow effects
- Festive lighting
- ONE simple party accessory only (party hat OR glasses OR party horn)
- Joyful, happy expression
COLOR PALETTE (VERY IMPORTANT):
- Primary body color: ${colors.primary}
- Secondary/accent colors: ${colors.secondary} and ${colors.accent}
- Glow and sparkle colors should use ${colors.highlight}
- Use these EXACT colors for the Party Puff character
COMPOSITION:
- Centered character
- Plain or softly glowing background
- Designed to look great as a circular profile picture`;

    // NEGATIVE PROMPT - FLUX respects this very well
    const negativePrompt = `realistic, photorealistic, horror, creepy, scary, abstract, surreal, extra eyes, extra faces, multiple mouths, deformed anatomy, fur, wrinkles, texture noise, painterly, sketchy, complex background, clutter, kirby, copyrighted character`;

    // FLUX 1.1 Pro - exact recommended settings
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
          prompt_upsampling: false // Use our exact prompt
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
