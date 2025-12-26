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

    // Base prompt - premium NYE transformation while preserving identity
    const basePrompt = "Transform the uploaded PFP into an ultra-premium New Year's Eve celebration portrait while preserving the original character's identity, silhouette, pose, and key defining features. Upgrade the look with dramatic cinematic lighting, celebratory atmosphere, confetti, bokeh highlights, sparkles, and premium styling. High-quality illustration or polished digital art style, crisp clean details, iconic profile-picture composition, centered head-and-shoulders framing, sharp focus on the subject.";
    
    // Conditional handling - prevents unwanted transformations
    // Note: In production, you'd detect the PFP type. For now, using generic preservation.
    const conditionalLine = "Keep the subject clearly recognizable with the same character design and species.";
    
    // Global negative prompt - MANDATORY
    const negativePrompt = "text, words, numbers, watermark, logo, signature, blurry, low detail, bad anatomy, extra limbs, deformed, mutated, different character, different face, different species, nsfw, gore, scary, horror, lowres, jpeg artifacts, messy background, cropped head, out of frame";

    // Vibe-specific suffixes (premium styling approach)
    const vibeSuffixes = {
      classic: 'Elegant black-and-gold New Year\'s Eve styling, tasteful party crown or hat, celebratory confetti burst, soft warm bokeh lights, refined festive mood, premium poster aesthetic.',
      sparkly: 'Radiant glitter highlights, shimmering particles, prismatic light flares, jewel-toned reflections, glowing rim light, high-fashion New Year\'s Eve portrait lighting.',
      fireworks: 'Huge colorful fireworks exploding in the background sky, vivid streaks and bursts, strong rim lighting from fireworks, dynamic celebration atmosphere, motion sparkle trails, bold high-energy contrast.',
      champagne: 'Luxury lounge New Year\'s Eve vibe, warm golden lighting, champagne reflections, crystal glass bokeh, elegant attire, sophisticated celebration mood, premium cinematic portrait.'
    };

    // Construct final prompt
    const prompt = `${basePrompt} ${conditionalLine} ${vibeSuffixes[style]}`;
    
    // Settings per spec: strength 0.60-0.68, steps 35-40, guidance 6.0-7.5
    const strength = 0.60;
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
