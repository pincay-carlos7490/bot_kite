const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');
const { Omggif } = require('omggif');
const { AttachmentBuilder } = require('discord.js');

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Dibuja los elementos del usuario (avatar redondo, nombre, miembro #) sobre un canvas
function drawOverlay(ctx, width, height, avatarImg, username, memberCount) {
  // 1. Capa de viñeta / degradado oscuro central para máxima legibilidad
  const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width / 1.5);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Dibujar avatar circular
  const avatarSize = 120;
  const avatarX = width / 2;
  const avatarY = 110;
  const avatarRadius = avatarSize / 2;

  // Borde resplandeciente blanco
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 5, 0, Math.PI * 2, true);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.restore();

  // Avatar recortado en círculo
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarSize, avatarSize);
    ctx.restore();
  }

  // 3. Texto moderno 1: "[Username] se acaba de unir al servidor"
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(`${username} se acaba de unir al servidor`, width / 2, 230);

  // 4. Insignia / Pill para el número de miembro "Miembro: #329107"
  const memberText = `Miembro: #${memberCount}`;
  ctx.font = '600 18px "Segoe UI", Roboto, Arial, sans-serif';
  const textWidth = ctx.measureText(memberText).width;
  
  const pillWidth = textWidth + 36;
  const pillHeight = 36;
  const pillX = (width - pillWidth) / 2;
  const pillY = 255;
  const pillRadius = 18;

  // Fondo de la insignia semitransparente estilo Discord
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
  ctx.fill();

  // Borde suave de la insignia
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Texto de la insignia
  ctx.fillStyle = '#FEE75C'; // Amarillo bonito
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(memberText, width / 2, pillY + 24);
  ctx.restore();
}

async function generateWelcomeImage(member, customBackgroundUrl) {
  const width = 800;
  const height = 360;
  const defaultBg = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop';
  const bgUrl = customBackgroundUrl || defaultBg;

  // Cargar avatar del usuario
  let avatarImg = null;
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    avatarImg = await loadImage(avatarUrl);
  } catch (err) {
    console.error('Error cargando avatar:', err);
  }

  // Comprobar si la URL del fondo es un GIF animado
  let isGif = false;
  let bgBuffer = null;

  try {
    bgBuffer = await fetchBuffer(bgUrl);
    // Verificar encabezado GIF (GIF87a o GIF89a)
    if (bgBuffer.length > 4 && bgBuffer.toString('ascii', 0, 3) === 'GIF') {
      isGif = true;
    }
  } catch (e) {
    console.error('Error descargando fondo:', e);
  }

  // CASO A: Si el fondo es un GIF animado, procesar cuadros del GIF
  if (isGif && bgBuffer) {
    try {
      const reader = new Omggif(bgBuffer);
      const numFrames = reader.numFrames();
      
      // Limitar a máximo 25 cuadros para rendimiento rápido y bajo tamaño de archivo
      const maxFrames = Math.min(numFrames, 25);
      const step = Math.max(1, Math.floor(numFrames / maxFrames));

      const encoder = new GIFEncoder(width, height);
      encoder.start();
      encoder.setRepeat(0); // Bucle infinito
      encoder.setDelay(80); // Velocidad aproximada de reproducción
      encoder.setQuality(10);

      const frameCanvas = createCanvas(width, height);
      const frameCtx = frameCanvas.getContext('2d');

      const tempCanvas = createCanvas(reader.width, reader.height);
      const tempCtx = tempCanvas.getContext('2d');
      const frameData = tempCtx.createImageData(reader.width, reader.height);

      for (let i = 0; i < numFrames; i += step) {
        reader.decodeImageData(i, frameData.data);
        tempCtx.putImageData(frameData, 0, 0);

        frameCtx.clearRect(0, 0, width, height);
        frameCtx.drawImage(tempCanvas, 0, 0, width, height);

        // Dibujar el diseño del usuario sobre cada cuadro del GIF
        drawOverlay(frameCtx, width, height, avatarImg, member.user.username, member.guild.memberCount);

        encoder.addFrame(frameCtx);
      }

      encoder.finish();
      const gifResultBuffer = encoder.out.getData();
      return new AttachmentBuilder(gifResultBuffer, { name: 'welcome-banner.gif' });
    } catch (gifErr) {
      console.error('Error procesando GIF animado, recurriendo a imagen estática:', gifErr);
    }
  }

  // CASO B: Si es una imagen estática (PNG/JPG) o como respaldo
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (bgBuffer) {
    try {
      const bgImg = await loadImage(bgBuffer);
      ctx.drawImage(bgImg, 0, 0, width, height);
    } catch (err) {
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, width, height);
  }

  drawOverlay(ctx, width, height, avatarImg, member.user.username, member.guild.memberCount);

  const pngBuffer = await canvas.encode('png');
  return new AttachmentBuilder(pngBuffer, { name: 'welcome-banner.png' });
}

module.exports = {
  generateWelcomeImage,
};
