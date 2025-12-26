/**
 * NYE PFP GLOW-UP PRODUCTION PIPELINE
 * Classifies PFPs and routes to appropriate enhancement method
 * 
 * CATEGORIES:
 * A - Illustrated/Semi-Realistic → SDXL img2img
 * B - Flat Cartoons/Mascots → Canvas compositing
 * C - Symbolic/Iconic Faces → Face-safe compositing
 */

// ========================================
// STEP 1: CLASSIFY PFP
// ========================================

/**
 * Analyzes image characteristics to determine enhancement category
 * @param {string} imageDataUrl - Base64 image data URL
 * @returns {Promise<'A'|'B'|'C'>} Category classification
 */
async function classifyPFP(imageDataUrl) {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const analysis = analyzeImageCharacteristics(imageData);
  
  // Decision tree based on image characteristics
  
  // CATEGORY C: Symbolic/Iconic Faces
  // High symmetry + low color variance + centered face = symbolic icon
  if (analysis.symmetryScore > 0.85 && 
      analysis.colorVariance < 40 && 
      analysis.faceAreaRatio > 0.6) {
    return 'C';
  }
  
  // CATEGORY B: Flat Cartoons/Mascots
  // Low gradient complexity + distinct flat colors + clean edges = flat cartoon
  if (analysis.gradientComplexity < 0.3 && 
      analysis.distinctColors < 20 && 
      analysis.edgeSharpness > 0.7) {
    return 'B';
  }
  
  // CATEGORY A: Illustrated/Semi-Realistic (default)
  // Everything else - photographic, shaded illustrations, NFTs
  return 'A';
}

/**
 * Analyzes image data for classification metrics
 */
function analyzeImageCharacteristics(imageData) {
  const { width, height, data } = imageData;
  
  return {
    symmetryScore: calculateSymmetry(imageData),
    colorVariance: calculateColorVariance(data),
    gradientComplexity: calculateGradientComplexity(imageData),
    distinctColors: countDistinctColors(data),
    edgeSharpness: calculateEdgeSharpness(imageData),
    faceAreaRatio: estimateFaceAreaRatio(imageData)
  };
}

// Simplified metric calculations
function calculateSymmetry(imageData) {
  // Compare left vs right half similarity
  const { width, height, data } = imageData;
  let diff = 0;
  let count = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      const leftIdx = (y * width + x) * 4;
      const rightIdx = (y * width + (width - x - 1)) * 4;
      
      for (let c = 0; c < 3; c++) {
        diff += Math.abs(data[leftIdx + c] - data[rightIdx + c]);
      }
      count += 3;
    }
  }
  
  return 1 - (diff / count / 255); // 0-1, higher = more symmetric
}

function calculateColorVariance(data) {
  // Simple color variance across image
  let sumR = 0, sumG = 0, sumB = 0;
  const pixels = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  
  const avgR = sumR / pixels;
  const avgG = sumG / pixels;
  const avgB = sumB / pixels;
  
  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    variance += Math.pow(data[i] - avgR, 2);
    variance += Math.pow(data[i + 1] - avgG, 2);
    variance += Math.pow(data[i + 2] - avgB, 2);
  }
  
  return Math.sqrt(variance / pixels / 3); // Lower = flatter colors
}

function calculateGradientComplexity(imageData) {
  // Measure gradient changes (low = flat, high = shaded)
  const { width, height, data } = imageData;
  let gradientSum = 0;
  let count = 0;
  
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const rightIdx = (y * width + x + 1) * 4;
      const downIdx = ((y + 1) * width + x) * 4;
      
      const diffRight = Math.abs(data[idx] - data[rightIdx]);
      const diffDown = Math.abs(data[idx] - data[downIdx]);
      
      gradientSum += (diffRight + diffDown) / 2;
      count++;
    }
  }
  
  return gradientSum / count / 255; // 0-1, higher = more gradients
}

function countDistinctColors(data, tolerance = 10) {
  const colorSet = new Set();
  
  for (let i = 0; i < data.length; i += 4) {
    // Quantize to reduce noise
    const r = Math.floor(data[i] / tolerance) * tolerance;
    const g = Math.floor(data[i + 1] / tolerance) * tolerance;
    const b = Math.floor(data[i + 2] / tolerance) * tolerance;
    colorSet.add(`${r},${g},${b}`);
  }
  
  return colorSet.size;
}

function calculateEdgeSharpness(imageData) {
  // Sobel edge detection approximation
  const { width, height, data } = imageData;
  let edgeSum = 0;
  let count = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Sample surrounding pixels
      const gx = (
        -data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x+1)) * 4] +
        -2 * data[(y * width + (x-1)) * 4] + 2 * data[(y * width + (x+1)) * 4] +
        -data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x+1)) * 4]
      );
      
      edgeSum += Math.abs(gx);
      count++;
    }
  }
  
  return Math.min(edgeSum / count / 255, 1); // Normalized edge strength
}

function estimateFaceAreaRatio(imageData) {
  // Simple center-mass estimation (faces typically centered)
  const { width, height, data } = imageData;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  
  let centerMass = 0;
  let totalMass = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const alpha = data[idx + 3];
      const mass = (255 - brightness) * (alpha / 255); // Dark pixels = content
      
      totalMass += mass;
      
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      if (dist < radius) {
        centerMass += mass;
      }
    }
  }
  
  return totalMass > 0 ? centerMass / totalMass : 0; // Ratio of content in center
}

// ========================================
// STEP 2: ROUTE TO APPROPRIATE PIPELINE
// ========================================

/**
 * Main routing function
 * @param {string} imageDataUrl - Base64 image data URL
 * @returns {Promise<string>} Enhanced image data URL
 */
async function enhancePFP(imageDataUrl) {
  // Classify the PFP
  const category = await classifyPFP(imageDataUrl);
  
  console.log('PFP Classification:', category);
  
  switch (category) {
    case 'A':
      // CATEGORY A: Use SDXL img2img
      return await enhanceWithAI(imageDataUrl);
      
    case 'B':
      // CATEGORY B: Use cartoon-safe compositing
      return await enhanceWithCompositing(imageDataUrl, 'standard');
      
    case 'C':
      // CATEGORY C: Use face-safe compositing
      return await enhanceWithCompositing(imageDataUrl, 'face-safe');
      
    default:
      throw new Error('Invalid category');
  }
}

/**
 * CATEGORY A: AI Enhancement via backend
 */
async function enhanceWithAI(imageDataUrl) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl })
  });
  
  if (!response.ok) {
    throw new Error('AI enhancement failed');
  }
  
  const data = await response.json();
  return data.imageUrl;
}

/**
 * CATEGORY B & C: Compositing Enhancement (client-side)
 */
async function enhanceWithCompositing(imageDataUrl, mode) {
  // Import compositing pipeline
  const { applyNYECompositing } = await import('./compositing-pipeline.js');
  return await applyNYECompositing(imageDataUrl, mode);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ========================================
// EXPORT
// ========================================

export { classifyPFP, enhancePFP };
