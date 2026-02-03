import { createImageDimensions, type ImageDimensions } from '../imageDimensions';

export function parseImageDimensions(buffer: Uint8Array, mimeType: string): ImageDimensions | undefined {
    try {
        let width: number | undefined;
        let height: number | undefined;

        if (mimeType === 'image/png') {
            // PNG: width @ 16-19, height @ 20-23 (big-endian).
            if (
                buffer.length >= 24 &&
                buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4e &&
                buffer[3] === 0x47
            ) {
                width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
                height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
            }
        } else if (mimeType === 'image/jpeg') {
            // JPEG: scan for SOF0/SOF2 markers.
            let offset = 2; // skip 0xFFD8
            while (offset < buffer.length - 9) {
                if (buffer[offset] !== 0xff) {
                    offset++;
                    continue;
                }
                const marker = buffer[offset + 1];
                if (marker === 0xc0 || marker === 0xc2) {
                    height = (buffer[offset + 5] << 8) | buffer[offset + 6];
                    width = (buffer[offset + 7] << 8) | buffer[offset + 8];
                    break;
                }
                const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
                offset += 2 + length;
            }
        } else if (mimeType === 'image/webp') {
            // WebP: RIFF + WEBP, then parse VP8/VP8L/VP8X chunks.
            if (
                buffer.length >= 30 &&
                buffer[0] === 0x52 &&
                buffer[1] === 0x49 &&
                buffer[2] === 0x46 &&
                buffer[3] === 0x46 &&
                buffer[8] === 0x57 &&
                buffer[9] === 0x45 &&
                buffer[10] === 0x42 &&
                buffer[11] === 0x50
            ) {
                // VP8X
                if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
                    width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
                    height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
                } else if (
                    buffer[12] === 0x56 &&
                    buffer[13] === 0x50 &&
                    buffer[14] === 0x38 &&
                    buffer[15] === 0x4c
                ) {
                    // VP8L
                    const signature = buffer[21];
                    if (signature === 0x2f) {
                        const bits = buffer[22] | (buffer[23] << 8) | (buffer[24] << 16) | (buffer[25] << 24);
                        width = (bits & 0x3fff) + 1;
                        height = ((bits >> 14) & 0x3fff) + 1;
                    }
                } else if (
                    buffer[12] === 0x56 &&
                    buffer[13] === 0x50 &&
                    buffer[14] === 0x38 &&
                    buffer[15] === 0x20
                ) {
                    // VP8 (lossy) frame header.
                    width = (buffer[26] | (buffer[27] << 8)) & 0x3fff;
                    height = (buffer[28] | (buffer[29] << 8)) & 0x3fff;
                }
            }
        } else if (mimeType === 'image/gif') {
            // GIF: width @ 6-7, height @ 8-9 (little-endian).
            if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
                width = buffer[6] | (buffer[7] << 8);
                height = buffer[8] | (buffer[9] << 8);
            }
        }

        if (width && height && width > 0 && height > 0) {
            return createImageDimensions(width, height);
        }
    } catch {
        // ignore
    }
    return undefined;
}

