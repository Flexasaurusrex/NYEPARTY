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
    
    console.log('Calling Imagen 3 API...');
    
    // Call Google Imagen 3 API with key as query param
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${process.env.GOOGLE_AI_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{
          prompt: prompt,
          negativePrompt: negativePrompt,
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          personGeneration: 'allow_adult'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imagen 3 API error status:', response.status);
      console.error('Imagen 3 API error response:', errorText);
      return res.status(500).json({ 
        error: `Imagen 3 API error (${response.status})`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Imagen 3 response received');

    // Extract generated image from Vertex AI response format
    if (!data.predictions || data.predictions.length === 0) {
      console.error('No predictions in response:', JSON.stringify(data));
      throw new Error('No images generated');
    }

    // Imagen 3 returns base64 image in predictions array
    const prediction = data.predictions[0];
    const imageData = `data:image/png;base64,${prediction.bytesBase64Encoded}`;

    console.log('Party Puff generated successfully!');

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
