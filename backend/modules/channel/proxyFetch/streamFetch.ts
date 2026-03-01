import * as http from 'http';
import * as tls from 'tls';
import { URL } from 'url';

import { t } from '../../../i18n';
import { ChannelError, ErrorType } from '../types';

import { DEFAULT_TIMEOUT_MS, USER_AGENT } from './constants';
import type { FetchOptions } from './types';

/**
 * Create a proxy-aware streaming fetch.
 *
 * Returns an async generator that yields raw response chunks as strings.
 */
export async function* proxyStreamFetch(
    url: string,
    init: FetchOptions,
    proxyUrl?: string
): AsyncGenerator<string> {
    if (!proxyUrl) {
        const headersWithUserAgent = { 'User-Agent': USER_AGENT, ...init.headers };
        const response = await fetch(url, {
            method: init.method,
            headers: headersWithUserAgent,
            body: init.body,
            signal: init.signal
        });

        if (!response.ok) {
            let errorBody: any;
            try {
                errorBody = await response.json();
            } catch {
                errorBody = await response.text();
            }
            throw new ChannelError(
                ErrorType.API_ERROR,
                t('modules.channel.errors.apiError', { status: response.status }),
                {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    url,
                    body: errorBody
                }
            );
        }

        if (!response.body) {
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                if (init.signal?.aborted) {
                    reader.cancel();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;
                yield decoder.decode(value, { stream: true });
            }

            // Flush TextDecoder internal buffer to avoid losing the last bytes.
            const rest = decoder.decode();
            if (rest) {
                yield rest;
            }
        } finally {
            reader.releaseLock();
        }
        return;
    }

    const targetUrl = new URL(url);
    const proxyParsed = new URL(proxyUrl);
    const targetHost = targetUrl.hostname;
    const targetPort = targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80);
    const isHttps = targetUrl.protocol === 'https:';

    if (init.signal?.aborted) {
        throw new Error('Request cancelled');
    }

    const socket = await new Promise<tls.TLSSocket | import('net').Socket>((resolve, reject) => {
        const timeout = init.timeout || DEFAULT_TIMEOUT_MS;

        // Listen to abort signal.
        const onAbort = () => {
            proxyReq.destroy();
            reject(new Error('Request cancelled'));
        };
        if (init.signal) {
            init.signal.addEventListener('abort', onAbort, { once: true });
        }

        const proxyReq = http.request({
            hostname: proxyParsed.hostname,
            port: proxyParsed.port || 80,
            method: 'CONNECT',
            path: `${targetHost}:${targetPort}`,
            timeout
        });

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
                    resolve(tlsSocket);
                });

                tlsSocket.on('error', (error: Error) => {
                    reject(new Error(`TLS error: ${error.message}`));
                });
            } else {
                resolve(socket);
            }
        });

        proxyReq.on('error', (error) => {
            reject(new Error(`Proxy request failed: ${error.message}`));
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            reject(new Error('Proxy request timeout'));
        });

        proxyReq.end();
    });

    // Send request.
    const body = init.body || '';
    const bodyBuffer = Buffer.from(body, 'utf8');

    const requestLine = `${init.method} ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n`;

    const headersWithUserAgent = { 'User-Agent': USER_AGENT, ...init.headers };
    const streamHeaders = [
        `Host: ${targetUrl.hostname}`,
        ...Object.entries(headersWithUserAgent).map(([k, v]) => `${k}: ${v}`),
        `Content-Length: ${bodyBuffer.length}`,
        'Connection: close',
        '',
        ''
    ].join('\r\n');

    socket.write(requestLine + streamHeaders);
    if (body) {
        socket.write(bodyBuffer);
    }

    // Read response.
    let rawBuffer = Buffer.alloc(0);
    let headersParsed = false;
    let statusCode = 0;
    let isChunked = false;
    let chunkedBuffer = Buffer.alloc(0);

    const onAbort = () => {
        socket.end();
    };
    if (init.signal) {
        init.signal.addEventListener('abort', onAbort, { once: true });
    }

    const decodeChunkedStream = (data: Buffer): { decoded: string, remaining: Buffer } => {
        let decoded = '';
        let offset = 0;

        while (offset < data.length) {
            // Find the end of chunk size line (\r\n).
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

            // Parse chunk size (hex).
            const sizeLine = data.subarray(offset, sizeEnd).toString('ascii').trim();
            const chunkSize = parseInt(sizeLine, 16);

            if (isNaN(chunkSize)) {
                // Invalid size line, skip.
                offset = sizeEnd + 2;
                continue;
            }

            if (chunkSize === 0) {
                // End marker.
                offset = data.length;
                break;
            }

            // Compute chunk data range.
            const chunkDataStart = sizeEnd + 2;
            const chunkDataEnd = chunkDataStart + chunkSize;

            if (chunkDataEnd + 2 > data.length) {
                // Incomplete data, keep remaining.
                break;
            }

            decoded += data.subarray(chunkDataStart, chunkDataEnd).toString('utf8');

            // Move to next chunk (skip trailing \r\n).
            offset = chunkDataEnd + 2;
        }

        return {
            decoded,
            remaining: data.subarray(offset)
        };
    };

    // Use event listeners instead of `for await` to avoid RST on early termination.
    try {
        const dataQueue: string[] = [];
        let readPromise: Promise<void> | null = null;
        let isReading = true;
        let readError: Error | null = null;

        const readData = (): Promise<void> => {
            return new Promise((resolve, reject) => {
                const onData = (chunk: Buffer) => {
                    if (init.signal?.aborted) {
                        cleanup();
                        resolve();
                        return;
                    }

                    rawBuffer = Buffer.concat([rawBuffer, chunk]);

                    if (!headersParsed) {
                        const headerEndMarker = Buffer.from('\r\n\r\n');
                        const headerEnd = rawBuffer.indexOf(headerEndMarker);

                        if (headerEnd !== -1) {
                            const headerPart = rawBuffer.subarray(0, headerEnd).toString('utf8');
                            const statusMatch = headerPart.match(/HTTP\/\d\.\d (\d+)/);
                            statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;

                            if (headerPart.toLowerCase().includes('transfer-encoding: chunked')) {
                                isChunked = true;
                            }

                            if (statusCode < 200 || statusCode >= 300) {
                                const errorBody = rawBuffer.subarray(headerEnd + 4).toString('utf8');
                                let parsedError: any;
                                try {
                                    parsedError = JSON.parse(errorBody);
                                } catch {
                                    parsedError = errorBody;
                                }
                                cleanup();
                                reject(new ChannelError(
                                    ErrorType.API_ERROR,
                                    t('modules.channel.errors.apiError', { status: statusCode }),
                                    {
                                        status: statusCode,
                                        url,
                                        body: parsedError
                                    }
                                ));
                                return;
                            }

                            headersParsed = true;
                            rawBuffer = rawBuffer.subarray(headerEnd + 4);
                        }
                    }

                    if (headersParsed && rawBuffer.length > 0) {
                        if (isChunked) {
                            chunkedBuffer = Buffer.concat([chunkedBuffer, rawBuffer]);
                            rawBuffer = Buffer.alloc(0);

                            const { decoded, remaining } = decodeChunkedStream(chunkedBuffer);
                            chunkedBuffer = Buffer.from(remaining);

                            if (decoded) {
                                dataQueue.push(decoded);
                            }
                        } else {
                            dataQueue.push(rawBuffer.toString('utf8'));
                            rawBuffer = Buffer.alloc(0);
                        }
                    }
                };

                const onEnd = () => {
                    cleanup();
                    resolve();
                };

                const onClose = () => {
                    cleanup();
                    resolve();
                };

                const onError = (err: Error) => {
                    cleanup();
                    reject(err);
                };

                const cleanup = () => {
                    socket.removeListener('data', onData);
                    socket.removeListener('end', onEnd);
                    socket.removeListener('close', onClose);
                    socket.removeListener('error', onError);
                };

                socket.on('data', onData);
                socket.on('end', onEnd);
                socket.on('close', onClose);
                socket.on('error', onError);
            });
        };

        readPromise = readData().catch(err => {
            readError = err;
            throw err;
        }).finally(() => {
            isReading = false;
        });

        while (isReading || dataQueue.length > 0) {
            if (init.signal?.aborted) {
                break;
            }

            if (readError) {
                throw readError;
            }

            if (dataQueue.length > 0) {
                yield dataQueue.shift()!;
            } else if (isReading) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        if (readError) {
            throw readError;
        }

        if (!init.signal?.aborted) {
            if (isChunked && chunkedBuffer.length > 0) {
                const { decoded } = decodeChunkedStream(chunkedBuffer);
                if (decoded) {
                    yield decoded;
                }
            } else if (rawBuffer.length > 0) {
                yield rawBuffer.toString('utf8');
            }
        }

        if (readPromise) {
            await readPromise.catch(() => {});
        }
    } finally {
        if (init.signal) {
            init.signal.removeEventListener('abort', onAbort);
        }

        // Gracefully close the socket to avoid ECONNRESET.
        await new Promise<void>((resolve) => {
            if (socket.destroyed || !socket.writable) {
                resolve();
                return;
            }

            const closeTimeout = setTimeout(() => {
                if (!socket.destroyed) {
                    socket.destroy();
                }
                resolve();
            }, 1000);

            socket.once('close', () => {
                clearTimeout(closeTimeout);
                resolve();
            });

            socket.end();
        });
    }
}
