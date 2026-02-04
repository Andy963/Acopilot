import * as http from 'http';
import * as tls from 'tls';
import { URL } from 'url';

import { DEFAULT_TIMEOUT_MS, USER_AGENT } from './constants';
import type { FetchOptions, FetchResponse } from './types';

export function createProxyFetch(proxyUrl?: string) {
    if (!proxyUrl) {
        return fetch;
    }

    return async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const targetUrl = typeof url === 'string' ? new URL(url) : url;
        const options: FetchOptions = {
            method: init?.method || 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                ...((init?.headers as Record<string, string>) || {})
            },
            body: init?.body as string | undefined,
            timeout: DEFAULT_TIMEOUT_MS,
            signal: init?.signal
        };

        const response = await fetchWithProxy(targetUrl, options, proxyUrl);

        const responseText = await response.text();
        return new Response(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    };
}

async function fetchWithProxy(
    targetUrl: URL,
    init: FetchOptions,
    proxyUrl: string
): Promise<FetchResponse> {
    const proxyParsed = new URL(proxyUrl);
    const targetHost = targetUrl.hostname;
    const targetPort = targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80);
    const isHttps = targetUrl.protocol === 'https:';

    if (init.signal?.aborted) {
        throw new Error('Request cancelled');
    }

    return new Promise((resolve, reject) => {
        const timeout = init.timeout || DEFAULT_TIMEOUT_MS;

        const proxyReq = http.request({
            hostname: proxyParsed.hostname,
            port: proxyParsed.port || 80,
            method: 'CONNECT',
            path: `${targetHost}:${targetPort}`,
            timeout
        });

        const onAbort = () => {
            proxyReq.destroy();
            reject(new Error('Request cancelled'));
        };
        if (init.signal) {
            init.signal.addEventListener('abort', onAbort, { once: true });
        }

        proxyReq.on('connect', (res, socket) => {
            if (res.statusCode !== 200) {
                socket.destroy();
                reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
                return;
            }

            if (isHttps) {
                const tlsSocket = tls.connect({
                    socket: socket,
                    servername: targetHost,
                    rejectUnauthorized: false
                }, () => {
                    sendRequestOverSocket(tlsSocket, targetUrl, init, resolve, reject);
                });

                tlsSocket.on('error', (error: Error) => {
                    reject(new Error(`TLS error: ${error.message}`));
                });
            } else {
                sendRequestOverSocket(socket, targetUrl, init, resolve, reject);
            }
        });

        proxyReq.on('error', (error) => {
            if (init.signal) {
                init.signal.removeEventListener('abort', onAbort);
            }
            reject(new Error(`Proxy request failed: ${error.message}`));
        });

        proxyReq.on('timeout', () => {
            if (init.signal) {
                init.signal.removeEventListener('abort', onAbort);
            }
            proxyReq.destroy();
            reject(new Error('Proxy request timeout'));
        });

        proxyReq.end();
    });
}

function sendRequestOverSocket(
    socket: tls.TLSSocket | import('net').Socket,
    targetUrl: URL,
    init: FetchOptions,
    resolve: (response: FetchResponse) => void,
    reject: (error: Error) => void
): void {
    if (init.signal?.aborted) {
        socket.destroy();
        reject(new Error('Request cancelled'));
        return;
    }

    const body = init.body || '';
    const bodyBuffer = Buffer.from(body, 'utf8');

    let aborted = false;
    const onAbort = () => {
        if (aborted) return;
        aborted = true;
        socket.destroy();
        reject(new Error('Request cancelled'));
    };
    if (init.signal) {
        init.signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = () => {
        if (init.signal) {
            init.signal.removeEventListener('abort', onAbort);
        }
    };

    const requestLine = `${init.method} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n`;

    const headersWithUserAgent = { 'User-Agent': USER_AGENT, ...init.headers };
    const headers = [
        `Host: ${targetUrl.hostname}`,
        ...Object.entries(headersWithUserAgent).map(([k, v]) => `${k}: ${v}`),
        `Content-Length: ${bodyBuffer.length}`,
        'Connection: close',
        '',
        ''
    ].join('\r\n');

    socket.write(requestLine + headers);
    if (body) {
        socket.write(bodyBuffer);
    }

    const chunks: Buffer[] = [];
    let headersParsed = false;
    let responseFinished = false;
    let statusCode = 0;
    let statusText = '';
    let contentLength = -1;
    let isChunked = false;
    let headerEndIndex = -1;
    let responseHeaders: Record<string, string> = {};

    const tryParseHeaders = (fullBuffer: Buffer): boolean => {
        const headerEndMarker = Buffer.from('\r\n\r\n');
        headerEndIndex = fullBuffer.indexOf(headerEndMarker);

        if (headerEndIndex === -1) {
            return false;
        }

        const headerPart = fullBuffer.subarray(0, headerEndIndex).toString('utf8');

        const lines = headerPart.split('\r\n');
        const statusLine = lines[0];
        const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+) (.+)/);
        statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        statusText = statusMatch ? statusMatch[2] : '';

        for (const line of lines.slice(1)) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                responseHeaders[key] = value;

                if (key === 'content-length') {
                    contentLength = parseInt(value);
                } else if (key === 'transfer-encoding' && value.includes('chunked')) {
                    isChunked = true;
                }
            }
        }

        headersParsed = true;
        return true;
    };

    const isResponseComplete = (fullBuffer: Buffer): boolean => {
        if (!headersParsed) {
            return false;
        }

        const bodyBuffer = fullBuffer.subarray(headerEndIndex + 4);

        if (isChunked) {
            const endMarker = Buffer.from('0\r\n\r\n');
            const hasEnd = bodyBuffer.includes(endMarker);
            const hasEndAlt = bodyBuffer.toString('utf8').includes('\r\n0\r\n');
            return hasEnd || hasEndAlt;
        } else if (contentLength >= 0) {
            return bodyBuffer.length >= contentLength;
        }

        return false;
    };

    const finishResponse = () => {
        if (responseFinished || aborted) {
            return;
        }
        responseFinished = true;
        cleanup();

        const fullBuffer = Buffer.concat(chunks);
        const bodyBuffer = fullBuffer.subarray(headerEndIndex + 4);

        const finalBody = isChunked ? decodeChunkedBuffer(bodyBuffer) : bodyBuffer.toString('utf8');

        resolve({
            ok: statusCode >= 200 && statusCode < 300,
            status: statusCode,
            statusText,
            headers: responseHeaders,
            text: async () => finalBody,
            json: async () => JSON.parse(finalBody),
            body: null
        });
    };

    socket.on('data', (chunk: Buffer) => {
        if (aborted) return;

        chunks.push(chunk);

        const fullBuffer = Buffer.concat(chunks);

        if (!headersParsed) {
            if (tryParseHeaders(fullBuffer) && isResponseComplete(fullBuffer)) {
                socket.end();
                finishResponse();
            }
        } else {
            if (isResponseComplete(fullBuffer)) {
                socket.end();
                finishResponse();
            }
        }
    });

    socket.on('end', () => {
        if (aborted) return;
        cleanup();
        if (headersParsed) {
            finishResponse();
        } else {
            reject(new Error('Connection closed before headers received'));
        }
    });

    socket.on('close', () => {
        if (aborted) return;
        cleanup();
        if (headersParsed && !responseFinished) {
            finishResponse();
        }
    });

    socket.on('error', (err) => {
        if (aborted) return;
        cleanup();
        reject(err);
    });
}

function decodeChunkedBuffer(data: Buffer): string {
    const resultChunks: Buffer[] = [];
    let offset = 0;

    while (offset < data.length) {
        let sizeEnd = -1;
        for (let i = offset; i < data.length - 1; i++) {
            if (data[i] === 0x0d && data[i + 1] === 0x0a) {
                sizeEnd = i;
                break;
            }
        }

        if (sizeEnd === -1) {
            break;
        }

        const sizeLine = data.subarray(offset, sizeEnd).toString('ascii');
        const chunkSize = parseInt(sizeLine.trim(), 16);

        if (chunkSize === 0 || isNaN(chunkSize)) {
            break;
        }

        const chunkDataStart = sizeEnd + 2;
        const chunkDataEnd = chunkDataStart + chunkSize;

        if (chunkDataEnd > data.length) {
            break;
        }

        resultChunks.push(data.subarray(chunkDataStart, chunkDataEnd));

        offset = chunkDataEnd + 2;
    }

    return Buffer.concat(resultChunks).toString('utf8');
}

