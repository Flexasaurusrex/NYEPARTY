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
    console.log('Has TOGETHER_API_KEY:', !!process.env.TOGETHER_API_KEY);

    // Style prompts
    const stylePrompts = {
      classic: 'wearing a glittery party hat with streamers, holding party blowers and confetti, with balloons and "2025" decorations in the background',
      sparkly: 'surrounded by sparklers and glitter, wearing a glamorous New Years crown, with champagne bubbles and golden confetti floating around',
      fireworks: 'with colorful fireworks exploding behind them, wearing festive sunglasses, holding sparklers, vibrant celebration atmosphere',
      champagne: 'in an elegant champagne celebration scene, wearing a sophisticated party outfit, with champagne glasses clinking and elegant decorations'
    };

    // Generate cartoon using FLUX.1.1-pro with image input
    const prompt = `Transform this into a festive New Year's 2025 cartoon. ${stylePrompts[style]}. Keep the character/person completely recognizable. Bright vibrant cartoon style, cheerful NYE celebration, confetti, balloons, 2025 decorations, professional digital art.`;
    
    console.log('Calling Together.ai FLUX.1.1-pro...');
    const imageResponse = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1.1-pro',
        prompt: prompt,
        image_url: image,
        prompt_strength: 0.7,
        width: 1024,
        height: 1024,
        steps: 28
      })
    });

    console.log('Together.ai response status:', imageResponse.status);

    if (!imageResponse.ok) {
      const errorData = await imageResponse.text();
      console.error('Together.ai error:', errorData);
      throw new Error(`Image generation failed: ${errorData}`);
    }

    const imageData = await imageResponse.json();
    const generatedImageUrl = imageData.data[0].url;

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
