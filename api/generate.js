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

    // Global negative prompt - MANDATORY, blocks human faces aggressively
    const negativePrompt = "human face, realistic human skin, photorealistic portrait, human anatomy, uncanny, scary, horror, gore, blurry, low quality, distorted face, extra limbs, bad hands, deformed fingers, duplicate face, cropped head, out of frame, watermark, logo, text, letters, numbers, messy background";

    // Production-ready anthropomorphic style prompts - ALL create party animals
    const stylePrompts = {
      classic: 'Reimagine the original character as an anthropomorphic party animal while preserving the original color palette, facial expression, accessories, pose, and framing. Wearing a glittery New Year\'s Eve party hat with colorful streamers, holding a party blower and loose confetti visible in the foreground. Festive balloons and soft celebratory lights in the background. Joyful, friendly party atmosphere. Clean illustration, PFP-ready.',
      sparkly: 'Reimagine the original character as an anthropomorphic party animal while preserving recognizable features, colors, and expression. Surrounded by glowing sparklers and floating golden glitter. Wearing a glamorous New Year\'s crown. Champagne bubbles rising through the scene, warm golden light, magical celebratory atmosphere. Sparkles concentrated around the head and shoulders. Clean, celebratory illustration.',
      fireworks: 'Reimagine the original character as an anthropomorphic party animal while preserving pose, color palette, and accessories. Wearing festive party sunglasses. Colorful fireworks exploding in the night sky behind the character, sparks reflecting in their eyes. Holding a lit sparkler. Energetic, playful New Year\'s Eve celebration. Bold, fun, expressive style. Clean illustration.',
      champagne: 'Reimagine the original character as an anthropomorphic party animal while preserving expression, accessories, and framing. Elegant New Year\'s Eve champagne celebration. Wearing a sophisticated party outfit. Champagne glasses clinking near the character, soft golden bokeh lights in the background. Refined, classy celebration mood. Clean, premium illustration.'
    };

    // Use unified approach - all styles transform to anthropomorphic animals
    const prompt = stylePrompts[style];
    const strength = 0.70; // Unified strength for consistent transformation
    
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
