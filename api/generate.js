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
    const { image, style } = req.body;

    if (!image || !style) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Starting image generation...');
    console.log('Style:', style);
    console.log('Has REPLICATE_API_KEY:', !!process.env.REPLICATE_API_KEY);

    // Base prompt - forces anthropomorphic transformation (used for ALL styles)
    const basePrompt = "Transform the input PFP into a stylized anthropomorphic party animal character portrait (animal head + humanoid body). Keep the same pose, framing, clothing silhouette, and overall color palette as the original PFP, but replace the human head with an animal head (clearly non-human: muzzle/beak/snout, fur/feathers/scales, animal ears). The result must read as an anthropomorphic animal, not a human in costume. High-quality illustration, clean lines, vibrant celebratory mood, portrait, centered subject.";
    
    // Negative prompt - blocks human faces and text aggressively
    const negativePrompt = 'human face, human head, realistic human skin, portrait photo, ugly, low quality, blurry, extra faces, deformed, disfigured, bad anatomy, text, watermark, logo, words, "2025" text, letters, numbers';

    // Random animal selection for variety while maintaining consistency
    const animals = ['fox', 'raccoon', 'tiger', 'bear', 'wolf', 'cat', 'dog', 'bunny', 'panda', 'koala', 'owl', 'crocodile'];
    const selectedAnimal = animals[Math.floor(Math.random() * animals.length)];
    const animalLine = `Animal type: ${selectedAnimal} (clearly visible animal features)`;

    // Vibe-specific additions (append to base)
    const vibePrompts = {
      classic: 'Wearing a glittery party hat, streamers, confetti burst, party blower in hand. Background: festive NYE decor, balloons, bokeh lights, celebratory atmosphere.',
      sparkly: 'Surrounded by glitter and sparkles, wearing a glamorous New Year\'s crown/tiara. Champagne bubbles floating, golden confetti, soft glow lighting, magical sparkle haze.',
      fireworks: 'Explosive fireworks lighting reflecting on the character, energetic celebration pose. Wearing oversized festive sunglasses, holding a sparkler. Background: colorful fireworks filling the sky, vibrant motion confetti, dynamic glow.',
      champagne: 'Elegant tuxedo/suit or classy party outfit, refined NYE vibe. Champagne toast moment, clinking glasses nearby, warm golden ambient lighting, upscale decorations.'
    };

    // Construct final prompt
    const prompt = `${basePrompt} ${animalLine} ${vibePrompts[style]}`;
    
    // Fireworks needs higher strength to overcome background-only tendency
    const strength = style === 'fireworks' ? 0.75 : 0.65;
    const guidance = style === 'fireworks' ? 9.0 : 8.5;
    
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
          num_inference_steps: 40,
          guidance_scale: guidance
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
