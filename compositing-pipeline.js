// NYE PFP Compositing Pipeline - For Flat/Cartoon Images
// NO AI - Pure image compositing with additive effects

/**
 * COMPOSITING PIPELINE
 * Applies NYE effects to flat/cartoon PFPs without AI generation
 * Preserves original image pixel-perfect, adds festive overlays only
 */

async function applyNYECompositing(imageDataUrl) {
  // Load original image
  const img = await loadImage(imageDataUrl);
  
  // Create canvas at original resolution
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  // === LAYER 1: SUBTLE BACKGROUND TINT ===
  // Apply first so it's behind everything
  applyBackgroundTint(ctx, canvas.width, canvas.height);
  
  // === LAYER 2: GLOW HALO ===
  // Soft glow behind the subject
  applyGlowHalo(ctx, img);
  
  // === LAYER 3: BASE LAYER (ORIGINAL PFP) ===
  // Draw original image pixel-perfect, unmodified
  ctx.drawImage(img, 0, 0);
  
  // === LAYER 4: BACKGROUND CONFETTI ===
  // Confetti behind subject (depth layer 1)
  applyConfettiLayer(ctx, canvas.width, canvas.height, 'background');
  
  // === LAYER 5: FOREGROUND CONFETTI ===
  // Confetti in front (depth layer 2)
  applyConfettiLayer(ctx, canvas.width, canvas.height, 'foreground');
  
  // === LAYER 6: SPARKLES / STAR BURSTS ===
  // Edge sparkles and accent glows
  applySparkles(ctx, img, canvas.width, canvas.height);
  
  // === LAYER 7: OPTIONAL MOTION ACCENTS ===
  // Subtle energy streaks
  applyMotionAccents(ctx, canvas.width, canvas.height);
  
  return canvas.toDataURL('image/png');
}

// ========================================
// LAYER IMPLEMENTATIONS
// ========================================

/**
 * LAYER 1: Background Tint
 * Soft radial gradient behind subject
 */
function applyBackgroundTint(ctx, width, height) {
  // Create radial gradient from center
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) / 2
  );
  
  // NYE festive colors - very subtle
  gradient.addColorStop(0, 'rgba(255, 215, 0, 0.12)'); // Gold center
  gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.08)'); // Purple mid
  gradient.addColorStop(1, 'rgba(25, 25, 112, 0.15)'); // Midnight blue edge
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * LAYER 2: Glow Halo
 * Soft luminous outline behind subject
 */
function applyGlowHalo(ctx, img) {
  // Save current state
  ctx.save();
  
  // Create temporary canvas for blur effect
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = img.width;
  glowCanvas.height = img.height;
  const glowCtx = glowCanvas.getContext('2d');
  
  // Draw image
  glowCtx.drawImage(img, 0, 0);
  
  // Apply glow using shadow (blur approximation)
  ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'; // Warm gold
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Blend mode for soft glow
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.3;
  
  // Draw blurred copy
  ctx.drawImage(glowCanvas, 0, 0);
  
  // Restore
  ctx.restore();
}

/**
 * LAYER 4 & 5: Confetti
 * Multi-depth confetti particles
 */
function applyConfettiLayer(ctx, width, height, depth) {
  const confettiCount = depth === 'background' ? 15 : 10;
  const confettiColors = [
    '#FFD700', // Gold
    '#FF1493', // Hot pink
    '#00CED1', // Turquoise
    '#FF6347', // Tomato red
    '#9370DB', // Purple
    '#32CD32'  // Lime green
  ];
  
  for (let i = 0; i < confettiCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = depth === 'background' ? 
      4 + Math.random() * 8 : // Smaller in back
      6 + Math.random() * 12; // Larger in front
    const rotation = Math.random() * 360;
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    const opacity = depth === 'background' ? 0.4 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4;
    
    // Avoid center area (face region)
    const centerX = width / 2;
    const centerY = height / 2;
    const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const centerRadius = Math.min(width, height) * 0.3;
    
    if (distFromCenter < centerRadius) {
      continue; // Skip confetti too close to center
    }
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.globalAlpha = opacity;
    
    // Draw confetti piece (rectangle with slight rounding)
    ctx.fillStyle = color;
    ctx.fillRect(-size/2, -size/4, size, size/2);
    
    ctx.restore();
  }
}

/**
 * LAYER 6: Sparkles
 * Star bursts near edges and accessories
 */
function applySparkles(ctx, img, width, height) {
  const sparkleCount = 8;
  const sparklePositions = [
    { x: 0.15, y: 0.15 }, // Top left
    { x: 0.85, y: 0.15 }, // Top right
    { x: 0.15, y: 0.85 }, // Bottom left
    { x: 0.85, y: 0.85 }, // Bottom right
    { x: 0.5, y: 0.1 },   // Top center
    { x: 0.1, y: 0.5 },   // Left center
    { x: 0.9, y: 0.5 },   // Right center
    { x: 0.5, y: 0.9 }    // Bottom center
  ];
  
  sparklePositions.forEach((pos, i) => {
    if (i >= sparkleCount) return;
    
    const x = pos.x * width;
    const y = pos.y * height;
    const size = 3 + Math.random() * 4;
    
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    
    // Draw 4-point star
    drawStar(ctx, x, y, 4, size, size * 2, '#FFD700');
    
    // Add subtle glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    drawStar(ctx, x, y, 4, size * 0.6, size * 1.2, '#FFFFFF');
    
    ctx.restore();
  });
}

/**
 * LAYER 7: Motion Accents
 * Subtle curved streaks for energy
 */
function applyMotionAccents(ctx, width, height) {
  const accentCount = 3;
  
  for (let i = 0; i < accentCount; i++) {
    // Random position on edges
    const startX = Math.random() < 0.5 ? Math.random() * width * 0.2 : width - Math.random() * width * 0.2;
    const startY = Math.random() * height;
    
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.random() * 0.15;
    ctx.strokeStyle = i % 2 === 0 ? '#FFD700' : '#FF1493';
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.lineCap = 'round';
    
    // Draw curved streak
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const controlX = startX + (Math.random() - 0.5) * 100;
    const controlY = startY + (Math.random() - 0.5) * 100;
    const endX = startX + (Math.random() - 0.5) * 60;
    const endY = startY + (Math.random() - 0.5) * 60;
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
    
    ctx.restore();
  }
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

function drawStar(ctx, x, y, points, innerRadius, outerRadius, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ========================================
// EXPORT
// ========================================

export { applyNYECompositing };
