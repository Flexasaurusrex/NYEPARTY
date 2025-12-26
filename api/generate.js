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
    console.log('Has GOOGLE_AI_KEY:', !!process.env.GOOGLE_AI_KEY);
    console.log('Has TOGETHER_API_KEY:', !!process.env.TOGETHER_API_KEY);

    // Style prompts
    const stylePrompts = {
      classic: 'wearing a glittery party hat with streamers, holding party blowers and confetti, with balloons and "2025" decorations in the background',
      sparkly: 'surrounded by sparklers and glitter, wearing a glamorous New Years crown, with champagne bubbles and golden confetti floating around',
      fireworks: 'with colorful fireworks exploding behind them, wearing festive sunglasses, holding sparklers, vibrant celebration atmosphere',
      champagne: 'in an elegant champagne celebration scene, wearing a sophisticated party outfit, with champagne glasses clinking and elegant decorations'
    };

    // Step 1: Analyze the image with Google AI (Gemini)
    console.log('Calling Google AI API...');
    const analysisResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_AI_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Describe this person\'s appearance in detail for creating a cartoon character. Focus on: facial features, hairstyle, hair color, skin tone, notable characteristics. Be specific but concise.'
              },
              {
                inline_data: {
                  mime_type: image.split(';')[0].split(':')[1],
                  data: image.split(',')[1]
                }
              }
            ]
          }
        ]
      })
    });

    console.log('Google AI response status:', analysisResponse.status);

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Google AI error:', errorText);
      throw new Error(`Image analysis failed: ${errorText}`);
    }

    const analysisData = await analysisResponse.json();
    const description = analysisData.candidates[0].content.parts[0].text;
    console.log('Description received:', description.substring(0, 100) + '...');

    // Step 2: Generate cartoon with Together.ai
    const prompt = `A fun, vibrant cartoon character illustration in a modern animation style. ${description}. The character is ${stylePrompts[style]}. Cartoon style, bright colors, cheerful expression, celebratory New Year's 2025 atmosphere, festive and joyful vibe, high quality digital art`;

    console.log('Calling Together.ai...');
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
