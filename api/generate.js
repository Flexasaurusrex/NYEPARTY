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

    // Style prompts
    const stylePrompts = {
      classic: 'wearing a glittery party hat with streamers, holding party blowers and confetti, with balloons and "2025" decorations in the background',
      sparkly: 'surrounded by sparklers and glitter, wearing a glamorous New Years crown, with champagne bubbles and golden confetti floating around',
      fireworks: 'with colorful fireworks exploding behind them, wearing festive sunglasses, holding sparklers, vibrant celebration atmosphere',
      champagne: 'in an elegant champagne celebration scene, wearing a sophisticated party outfit, with champagne glasses clinking and elegant decorations'
    };

    // Step 1: Analyze the image with Nano Banana (Google AI Studio)
    const analysisResponse = await fetch('https://api.nanobanana.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash-exp',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this person\'s appearance in detail for creating a cartoon character. Focus on: facial features, hairstyle, hair color, skin tone, notable characteristics. Be specific but concise.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!analysisResponse.ok) {
      throw new Error('Image analysis failed');
    }

    const analysisData = await analysisResponse.json();
    const description = analysisData.choices[0].message.content;

    // Step 2: Generate cartoon with Together.ai
    const prompt = `A fun, vibrant cartoon character illustration in a modern animation style. ${description}. The character is ${stylePrompts[style]}. Cartoon style, bright colors, cheerful expression, celebratory New Year's 2025 atmosphere, festive and joyful vibe, high quality digital art`;

    const imageResponse = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1
      })
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.text();
      console.error('Together.ai error:', errorData);
      throw new Error('Image generation failed');
    }

    const imageData = await imageResponse.json();
    const generatedImageUrl = imageData.data[0].url;

    return res.status(200).json({ imageUrl: generatedImageUrl });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
