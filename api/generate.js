export default async function handler(req, res) {
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

    console.log('Starting Party Puff generation with Imagen 3...');
    console.log('Has GOOGLE_AI_KEY:', !!process.env.GOOGLE_AI_KEY);

    // PARTY PUFF PROMPT - Optimized for Imagen 3
    const prompt = `Create a cute, friendly cartoon mascot called a "Party Puff" celebrating New Year's Eve.
The Party Puff is a simple, round, non-human character with:
- a smooth circular body
- EXACTLY two large friendly eyes
- one small smiling mouth
- no nose
- no extra faces or features
- clean, flat shapes
- soft vector-style shading
The character must look wholesome, adorable, and safe — like a modern game mascot or sticker.
New Year's Eve theme:
- colorful confetti floating around
- soft glowing highlights
- sparkles and celebratory light effects
- a small festive accessory (party hat or glasses is okay)
- joyful, energetic expression
Color inspiration:
- use the uploaded image ONLY to guide the color palette and glow accents
- do NOT copy characters, faces, or shapes from the uploaded image
Style:
- clean cartoon illustration
- smooth edges
- no texture noise
- no realism
- no painterly brush strokes
Composition:
- centered character
- clear silhouette
- designed to look great as a profile picture`;
    
    // Negative prompt - simplified
    const negativePrompt = `scary, creepy, horror, realistic, abstract, surreal, extra eyes, extra faces`;
    
    console.log('Starting Party Puff generation with FLUX...');
    console.log('Has REPLICATE_API_KEY:', !!process.env.REPLICATE_API_KEY);

    // FLUX is much better at cartoons/mascots than SDXL
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
          prompt: prompt,
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 90,
          safety_tolerance: 2, // Allow creative content
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
