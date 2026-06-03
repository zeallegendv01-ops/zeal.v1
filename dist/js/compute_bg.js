(function(){
  function rgbToHex(r,g,b){
    return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
  }

  function getContrastColor(r,g,b){
    // Perceived luminance
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.6 ? '#ffffff' : '#000000';
  }

  function getDominantColor(img, callback){
    try {
      const canvas = document.createElement('canvas');
      const size = 40; // small sample
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0,0,size,size).data;
      let r=0,g=0,b=0,count=0;
      // sample every 4th pixel for speed
      for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i+3];
        if (alpha === 0) continue;
        r += data[i];
        g += data[i+1];
        b += data[i+2];
        count++;
      }
      if (!count) { callback(null); return; }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      callback({ r, g, b, hex: rgbToHex(r,g,b) });
    } catch (err) {
      console.warn('Could not extract image color (CORS or other):', err);
      callback(null);
    }
  }

  function applyBadgeColor(col){
    const badge = document.getElementById('heritageBadge');
    if (!badge) return;
    if (!col) return; // keep default
    badge.style.background = col.hex;
    badge.style.color = getContrastColor(col.r, col.g, col.b);
  }

  function initBadgeFromAboutImage(){
    const img = document.getElementById('aboutImage');
    if (!img) return;
    if (img.complete && img.naturalWidth !== 0) {
      getDominantColor(img, applyBadgeColor);
    } else {
      img.addEventListener('load', function(){ getDominantColor(img, applyBadgeColor); });
      img.addEventListener('error', function(){ /* leave default */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBadgeFromAboutImage);
  } else {
    initBadgeFromAboutImage();
  }
})();
