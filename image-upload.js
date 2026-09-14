export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file?.type)) {
    throw new Error('JPG, PNG, WebP, AVIF 사진을 선택해 주세요.');
  }
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('15MB 이하의 사진을 선택해 주세요.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.'); }
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('압축 후 사진이 너무 큽니다. 더 작은 사진을 선택해 주세요.');
    return blob;
  } finally { bitmap.close(); }
}
