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

    console.log('Starting image generation...');
    console.log('Has REPLICATE_API_KEY:', !!process.env.REPLICATE_API_KEY);

    // MASTER PROMPT - LOCKED, NO VARIANTS
    const masterPrompt = "Enhance the uploaded profile picture into a clean, premium New Year's Eve glow-up while keeping the same character, same face, same pose, same framing, and same background structure. Apply subtle celebratory lighting, tasteful festive color grading, soft glow highlights, light confetti particles, and a refined New Year's Eve atmosphere layered over the original image. Preserve the subject's natural facial features and expression. Avoid exaggerated styling, heavy makeup, or dramatic redesigns. The result should feel like the exact same PFP, elevated for New Year's Eve, not a new illustration, not a poster, and not a different character. High-quality illustration or polished digital art, centered profile-picture composition, sharp focus on the subject.";
    
    // Conditional line - optional guardrails (safe to include)
    const conditionalLine = "Keep the same species and character design exactly.";
    
    // NEGATIVE PROMPT - LOCKED (doing heavy lifting)
    const negativePrompt = "text, letters, numbers, words, typography, watermark, logo, poster, banner, title, headline, printed text on clothing, logos on clothing, symbols on clothing, heavy makeup, bright lipstick, glossy lipstick, exaggerated lips, drag makeup, theatrical makeup, runway makeup, different face, different person, different character, redesigned character, deformed, mutated, extra limbs, cropped head, out of frame, blurry, low detail, low resolution, messy background";

    // Final prompt - NO VIBES, universal enhancement
    const prompt = `${masterPrompt} ${conditionalLine}`;
    
    // LOCKED SETTINGS - stop tweaking
    const strength = 0.56;
    const steps = 32;
    const guidance = 6.2;
    
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
