/**
 * FreePad Audio Trimmer Utility
 * Precision client-side audio slicing and WAV encoding
 */

function setString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    output.setInt16(offset, s, true);
  }
}

export function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved;
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    interleaved = new Float32Array(left.length + right.length);
    let index = 0;
    for (let i = 0; i < left.length; i++) {
      interleaved[index++] = left[i];
      interleaved[index++] = right[i];
    }
  } else {
    interleaved = audioBuffer.getChannelData(0);
  }

  const dataLength = interleaved.length * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF identifier
  setString(view, 0, 'RIFF');
  // file length minus RIFF identifier and length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  setString(view, 8, 'WAVE');
  // format chunk identifier
  setString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  setString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  // write interleaved samples
  floatTo16BitPCM(view, 44, interleaved);

  return buffer;
}

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Slice an AudioBuffer from startTime to endTime
 */
export async function sliceAudioBuffer(originalBuffer, startTime, endTime) {
  const sampleRate = originalBuffer.sampleRate;
  const numChannels = originalBuffer.numberOfChannels;

  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(originalBuffer.length, Math.floor(endTime * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);

  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtx(numChannels, frameCount, sampleRate);
  const newBuffer = offlineCtx.createBuffer(numChannels, frameCount, sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const srcChannel = originalBuffer.getChannelData(c);
    const dstChannel = newBuffer.getChannelData(c);
    dstChannel.set(srcChannel.subarray(startSample, endSample));
  }

  return newBuffer;
}
