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

    // Global prefix - preserves identity
    const globalPrefix = "Preserve the original character's identity, face shape, hairstyle, colors, and recognizable features from the input image. Keep the same character centered and framed as a profile picture. Do not change the character's species or core design. Transform the character into a joyful New Year's Eve party version while maintaining recognizability.";
    
    // Global negative prompt
    const negativePrompt = "blurry, low quality, distorted face, extra limbs, bad hands, deformed fingers, cross-eye, duplicate face, cropped head, out of frame, watermark, logo, text, letters, numbers, scary, uncanny, overexposed, messy background";

    // Production-ready style prompts
    const stylePrompts = {
      classic: 'Wearing a glittery New Year\'s Eve party hat with colorful streamers, holding a party blower and loose confetti visible in the foreground. Festive balloons and soft celebratory lights in the background. Joyful expression, bright party atmosphere. No readable text.',
      sparkly: 'Surrounded by glowing sparklers and floating golden glitter, wearing a glamorous New Year\'s crown. Champagne bubbles rising through the scene, warm golden light, magical celebratory atmosphere. Sparkles clearly visible around the character\'s head and shoulders.',
      fireworks: 'Colorful fireworks bursting in the night sky behind the character, soft glow lighting their face. Wearing festive party sunglasses and holding a lit sparkler. Vibrant New Year\'s celebration atmosphere, energetic but clean composition.',
      champagne: 'Elegant New Year\'s Eve champagne celebration. Wearing a sophisticated party outfit. Two champagne glasses clinking near the character, soft golden bokeh lights in the background. Refined, celebratory mood, warm highlights.'
    };

    // Use Replicate's img2img for actual transformation
    const prompt = `${globalPrefix} ${stylePrompts[style]}`;
    
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
          strength: 0.6,
          num_inference_steps: 40,
          guidance_scale: 6.5
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
