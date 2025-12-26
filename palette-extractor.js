// CLIENT-SIDE PALETTE EXTRACTION + SPECIES CUE
// No libraries - pure Canvas API

function extractPaletteAndSpecies(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Downscale to 64x64 for speed
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 64, 64);
      
      const imageData = ctx.getImageData(0, 0, 64, 64);
      const data = imageData.data;
      
      // Color buckets (4 bits per channel = 4096 buckets)
      const buckets = {};
      let totalSaturation = 0;
      let totalBrightness = 0;
      let validPixels = 0;
      let edgeScore = 0;
      let pinkScore = 0;
      
      // First pass: count colors and compute stats
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Skip transparent pixels
        if (a < 128) continue;
        
        // Skip near-white/near-black backgrounds
        const brightness = Math.max(r, g, b);
        const darkness = Math.min(r, g, b);
        if ((brightness > 240 && darkness > 240) || (brightness < 15)) continue;
        
        // Quantize to 4 bits per channel
        const qr = r >> 4;
        const qg = g >> 4;
        const qb = b >> 4;
        const bucketKey = `${qr},${qg},${qb}`;
        
        buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
        
        // Compute saturation and brightness
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max > 0 ? (max - min) / max : 0;
        const bri = max / 255;
        
        totalSaturation += sat;
        totalBrightness += bri;
        validPixels++;
        
        // Pinkness score (high R & B, lower G)
        if (r > 150 && b > 100 && g < r * 0.7) {
          pinkScore++;
        }
      }
      
      // Edge detection pass
      for (let y = 0; y < 63; y++) {
        for (let x = 0; x < 63; x++) {
          const i = (y * 64 + x) * 4;
          const iRight = (y * 64 + x + 1) * 4;
          const iDown = ((y + 1) * 64 + x) * 4;
          
          edgeScore += Math.abs(data[i] - data[iRight]) + 
                       Math.abs(data[i + 1] - data[iRight + 1]) + 
                       Math.abs(data[i + 2] - data[iRight + 2]);
          edgeScore += Math.abs(data[i] - data[iDown]) + 
                       Math.abs(data[i + 1] - data[iDown + 1]) + 
                       Math.abs(data[i + 2] - data[iDown + 2]);
        }
      }
      
      edgeScore = edgeScore / (64 * 64 * 6); // Normalize
      const avgSaturation = totalSaturation / validPixels;
      const avgBrightness = totalBrightness / validPixels;
      const pinkness = pinkScore / validPixels;
      
      // Sort buckets by frequency and get top 4
      const sortedBuckets = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      
      // Convert buckets back to hex colors (use center of bucket)
      const paletteHex = sortedBuckets.map(([key]) => {
        const [qr, qg, qb] = key.split(',').map(Number);
        const r = (qr << 4) + 8; // Center of bucket
        const g = (qg << 4) + 8;
        const b = (qb << 4) + 8;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
      
      // Species cue heuristics
      let speciesCue;
      if (edgeScore > 40) {
        speciesCue = "dino puff";
      } else if (pinkness > 0.3 && edgeScore < 25) {
        speciesCue = "kirby-like puff";
      } else if (avgBrightness < 0.4 && avgSaturation > 0.5) {
        speciesCue = "cyber puff";
      } else if (avgSaturation < 0.2) {
        speciesCue = "monochrome puff";
      } else {
        speciesCue = "party puff";
      }
      
      resolve({
        paletteHex,
        speciesCue,
        stats: { edgeScore, avgSaturation, avgBrightness, pinkness } // For debugging
      });
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractPaletteAndSpecies };
}
