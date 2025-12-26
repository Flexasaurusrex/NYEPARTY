// Helper function to extract colors from data URL
function extractColorsFromDataURL(dataURL) {
  // Simple color extraction based on data URL analysis
  // In production, this could use image analysis, but for now use smart defaults
  
  const colorDescriptions = [
    { colors: ['warm gold', 'amber', 'champagne'], vibe: 'Bright champagne' },
    { colors: ['deep blue', 'electric cyan', 'midnight'], vibe: 'Cool midnight' },
    { colors: ['hot pink', 'magenta', 'rose gold'], vibe: 'Vibrant neon' },
    { colors: ['lime green', 'electric green', 'chartreuse'], vibe: 'High-energy electric' },
    { colors: ['purple', 'violet', 'amethyst'], vibe: 'Mystical glow' },
    { colors: ['orange', 'coral', 'sunset'], vibe: 'Energetic sunset' }
  ];
  
  // Randomly pick inspired colors (in production, analyze actual image)
  const colorSet = colorDescriptions[Math.floor(Math.random() * colorDescriptions.length)];
  const primaryColor = colorSet.colors[0];
  const accentColor = colorSet.colors[Math.floor(Math.random() * colorSet.colors.length)];
  
  return {
    description: `${primaryColor} with ${accentColor} accents`,
    vibe: colorSet.vibe
  };
}

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

    console.log('Starting Party Puff generation...');
    console.log('Has REPLICATE_API_KEY:', !!process.env.REPLICATE_API_KEY);
    
    // Extract dominant colors from uploaded image
    const colorInfo = extractColorsFromDataURL(image);
    console.log('Color palette:', colorInfo);

    // PARTY PUFF BASE PROMPT - LOCKED
    const basePuffPrompt = "A Party Puff — a cute, round, cartoon party creature with a soft squishy body, big expressive eyes, and a simple joyful expression. The Party Puff is celebrating New Year's Eve with high-energy party vibes: floating confetti, sparkling light effects, glowing highlights, and festive chaos. The character design remains consistent and iconic. Add playful New Year's Eve details such as a party hat, festive glasses, party horn, champagne sparkle effects, or fireworks reflections — keep it fun, cute, and celebratory. High-quality cartoon illustration, smooth shading, vibrant colors, magical lighting, joyful expression, centered composition, designed to be used as a profile picture.";
    
    // Color mapping from uploaded image
    const colorGuidance = `The Party Puff's body color and glow accents are inspired by ${colorInfo.description}. ${colorInfo.vibe} energy and lighting mood.`;
    
    // Final prompt
    const prompt = `${basePuffPrompt} ${colorGuidance}`;
    
    // NEGATIVE PROMPT - LOCKED
    const negativePrompt = "human, realistic, photorealistic, animal anatomy, detailed limbs, text, letters, numbers, typography, watermark, logo, scary, creepy, grotesque, distorted face, low quality, blurry, noisy, muddy colors, copyrighted character, kirby";
    
    // SETTINGS - Pure generation mode (not img2img!)
    const strength = 0.95; // High strength for creative generation
    const steps = 32;
    const guidance = 7.0;
    
    console.log('Starting Replicate prediction...');
    
    // Create prediction
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        version: '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
        input: {
          image: image,
          prompt: prompt,
          negative_prompt: negativePrompt,
          strength: strength,
          num_inference_steps: steps,
          guidance_scale: guidance,
          disable_safety_checker: true
        }
      })
    });

    if (!predictionResponse.ok) {
      const errorData = await predictionResponse.text();
      console.error('Replicate error:', errorData);
      throw new Error(`Prediction creation failed: ${errorData}`);
    }

    let prediction = await predictionResponse.json();
    console.log('Prediction created:', prediction.id);
    console.log('Initial status:', prediction.status);

    // Poll for completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_KEY}`
        }
      });
      
      prediction = await statusResponse.json();
      console.log(`Attempt ${attempts}: Status = ${prediction.status}`);
    }

    if (prediction.status === 'failed') {
      console.error('Prediction failed:', prediction.error);
      throw new Error(`Image generation failed: ${prediction.error}`);
    }

    if (attempts >= maxAttempts) {
      throw new Error('Image generation timed out');
    }

    const generatedImageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    
    console.log('Success! Image URL:', generatedImageUrl);
    return res.status(200).json({ imageUrl: generatedImageUrl });

  } catch (error) {
    console.error('Full error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    });
  }
}
