const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paletteHex, speciesCue } = req.body;

    function hexToColorName(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = Math.max(r, g, b);
      
      if (r > g && r > b) {
        if (brightness < 100) return 'dark red';
        if (brightness > 200) return 'bright red';
        return 'red';
      }
      if (g > r && g > b) {
        if (brightness < 100) return 'dark green';
        if (brightness > 200) return 'bright green';
        return 'green';
      }
      if (b > r && b > g) {
        if (brightness < 100) return 'dark blue';
        if (brightness > 200) return 'bright blue';
        return 'blue';
      }
      if (r > 150 && g > 150) return 'yellow';
      if (r > 150 && b > 150) return 'pink';
      if (brightness < 80) return 'black';
      if (brightness > 200) return 'white';
      return 'gray';
    }
    
    const primaryColor = hexToColorName(paletteHex[0]);
    const secondaryColor = hexToColorName(paletteHex[1]);
    const accentColor = hexToColorName(paletteHex[2]);
    
    // Sub-species variations for visual diversity
    const subSpecies = [
      "with tiny stubby arms",
      "with little round feet",
      "with small pointy ears",
      "with a fluffy tuft on top",
      "with tiny wings",
      "with a curly tail",
      "with antenna on head",
      "with small spikes along back",
      "with big round ears",
      "with a small horn"
    ];
    const selectedSubSpecies = subSpecies[Math.floor(Math.random() * subSpecies.length)];
    
    const vibes = [
      "ecstatic and jumping with joy, confetti exploding around them",
      "dizzy and spinning with stars circling their head, party hat flying off",
      "exhausted but happy, surrounded by empty champagne bottles and party debris",
      "mischievously laughing while covered in glitter and streamers",
      "dancing wildly with arms up, champagne foam spraying",
      "sleepy and content, hugging a champagne bottle like a teddy bear",
      "excited and yelling with a party horn, confetti shooting out",
      "playfully tangled in streamers, giggling",
      "triumphantly raising a champagne bottle overhead like a trophy",
      "laying down surrounded by party chaos, looking satisfied"
    ];
    const selectedVibe = vibes[Math.floor(Math.random() * vibes.length)];
    
    const prompt = `Flat 2D vector illustration. Simple cartoon. Game sprite style. Sticker art.

A cute round 'Party Puff' mascot - a ${speciesCue} ${selectedSubSpecies}, celebrating New Year's Eve.
The Party Puff is ${selectedVibe}.

ART STYLE (LOCKED):
2D flat illustration
Vector art style
Simple shapes with bold outlines
Flat cell shading
Like a: game character icon, emoji, or digital sticker
NO 3D
NO realistic rendering
NO fur texture
NO depth effects

CHARACTER:
Simple round body ${selectedSubSpecies}
Two simple eyes (dots or ovals)
Small smile
Minimal geometric shapes
Flat colors

COLORS:
Body: ${primaryColor}
Details: ${secondaryColor}
Accents: ${accentColor}

SCENE:
NYE party elements (confetti, sparkles, streamers)
Simple flat background
Celebratory

1:1 square format, centered, 2D flat illustration.`;

    const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid'
      })
    });

    const dalleData = await dalleResponse.json();
    
    if (dalleData.error) {
      return res.status(500).json({ error: dalleData.error.message });
    }

    return res.status(200).json({
      success: true,
      imageUrl: dalleData.data[0].url
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
