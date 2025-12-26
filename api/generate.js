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

    // Base prompt - TRANSFORMATIONAL (scene + wardrobe + lighting rewrite)
    const basePrompt = "Transform the uploaded PFP into a dramatic New Year's Eve celebration portrait while keeping the same character recognizable. Mandatory changes: – Upgrade the outfit to a New Year's Eve–appropriate look (partywear, evening jacket, luxury styling) – Change the environment to a celebratory NYE scene (nighttime, lights, energy, atmosphere) – Introduce bold cinematic lighting different from the original image. Preserve the subject's identity, facial features, pose, and general color palette, but do not keep the original background or lighting unchanged. High-impact illustration or polished digital art, centered head-and-shoulders portrait, iconic PFP composition, sharp focus on the subject.";
    
    // Conditional for non-human PFPs
    const conditionalLine = "If the character is non-human, preserve the same character design exactly; only upgrade lighting, environment, and celebratory styling.";
    
    // Global negative prompt
    const negativePrompt = "text, words, numbers, watermark, logo, signature, blurry, low detail, bad anatomy, extra limbs, deformed, mutated, different character, different face, different species, nsfw, gore, scary, horror, lowres, jpeg artifacts, messy background, cropped head, out of frame";

    // Vibe-specific suffixes - STRUCTURAL not cosmetic
    const vibeSuffixes = {
      classic: 'Classic New Year\'s Eve party scene. Formal party attire, elevated styling, celebratory confetti in motion, warm gold-and-black color accents, soft crowd-light bokeh in the background. Lighting and environment must differ clearly from the original image.',
      sparkly: 'Glamorous NYE glow-up. High-fashion lighting setup, intense rim light, glittering particles interacting with the subject, prismatic reflections on glasses and jewelry, radiant sparkle atmosphere. Scene should feel dramatically more luminous than the original.',
      fireworks: 'Fireworks celebration scene. Large colorful fireworks filling the night sky behind the subject, strong colored rim light cast from fireworks, dynamic lighting shifts across the face, visible motion energy and celebration intensity. Replace any static background with an active night celebration scene.',
      champagne: 'Luxury NYE champagne celebration. Upscale evening attire, warm golden lighting, reflections from crystal glassware, elegant lounge or rooftop party setting. Scene should feel premium and cinematic, not minimal.'
    };

    // Construct final prompt
    const prompt = `${basePrompt} ${conditionalLine} ${vibeSuffixes[style]}`;
    
    // Settings: need to cross 0.65 to force wardrobe/background change
    const strength = 0.68;
    const steps = 38;
    const guidance = 6.5;
    
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
