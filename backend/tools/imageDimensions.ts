// ==================== 图片尺寸计算工具 ====================

/**
 * 图片尺寸信息
 */
export interface ImageDimensions {
    width: number;
    height: number;
    aspectRatio: string;  // 如 "16:9", "4:3", "1:1"
}

/**
 * 计算最大公约数
 */
function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
}

/**
 * 计算宽高比字符串
 *
 * @param width 宽度
 * @param height 高度
 * @returns 宽高比字符串，如 "16:9", "4:3", "1:1"
 */
export function calculateAspectRatio(width: number, height: number): string {
    if (width <= 0 || height <= 0) {
        return '1:1';
    }
    
    const divisor = gcd(width, height);
    const ratioW = width / divisor;
    const ratioH = height / divisor;
    
    // 如果比例数字太大，使用近似值
    if (ratioW > 100 || ratioH > 100) {
        const ratio = width / height;
        // 常见比例检测
        if (Math.abs(ratio - 16/9) < 0.05) return '16:9';
        if (Math.abs(ratio - 9/16) < 0.05) return '9:16';
        if (Math.abs(ratio - 4/3) < 0.05) return '4:3';
        if (Math.abs(ratio - 3/4) < 0.05) return '3:4';
        if (Math.abs(ratio - 3/2) < 0.05) return '3:2';
        if (Math.abs(ratio - 2/3) < 0.05) return '2:3';
        if (Math.abs(ratio - 1) < 0.05) return '1:1';
        if (Math.abs(ratio - 21/9) < 0.05) return '21:9';
        if (Math.abs(ratio - 9/21) < 0.05) return '9:21';
        // 返回小数比例
        return `${ratio.toFixed(2)}:1`;
    }
    
    return `${ratioW}:${ratioH}`;
}

/**
 * 从宽高创建完整的尺寸信息
 */
export function createImageDimensions(width: number, height: number): ImageDimensions {
    return {
        width,
        height,
        aspectRatio: calculateAspectRatio(width, height)
    };
}
