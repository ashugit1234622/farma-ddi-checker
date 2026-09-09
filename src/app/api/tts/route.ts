import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().min(1),
});

// Microsoft Edge TTS uses a WebSocket API that we can call directly.
// This is the same endpoint the edge-tts Python/CLI tools use.
// No API key needed — it's the same service the Edge browser uses.
const TTS_WS_URL =
  "wss://eastus.api.speech.microsoft.com/cognitiveservices/websocket/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=";

function randomHex(len: number) {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * 16)];
  return result;
}

function makeConnectionId() {
  return randomHex(32);
}

function makeRequestId() {
  return randomHex(32);
}

function buildSSMLPayload(text: string, voice: string): string {
  // Sanitise text for XML
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody rate='-5%'>${safe}</prosody></voice></speak>`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { text, voice } = parsed.data;

  try {
    // We MUST use the `ws` package because native WebSockets (even in Node 21+)
    // do not support setting custom headers in the constructor. Edge TTS requires
    // specific Origin and User-Agent headers or it will instantly reject the connection.
    const { default: WS } = await import("ws");
    const WSClass = WS as unknown as typeof WebSocket;

    const connId = makeConnectionId();
    const reqId = makeRequestId();

    const audioChunks: Buffer[] = [];

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("TTS timeout")), 15000);

      const ws = new (WSClass as any)(
        `${TTS_WS_URL}${connId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
            "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
          },
        }
      );

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        // 1. Send config message
        const configMsg =
          `X-Timestamp:${new Date().toISOString()}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMsg);

        // 2. Send SSML synthesis request
        const ssml = buildSSMLPayload(text, voice);
        const ssmlMsg =
          `X-RequestId:${reqId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${new Date().toISOString()}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;
        ws.send(ssmlMsg);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          // Text frame — check for turn.end
          if (event.data.includes("Path:turn.end")) {
            clearTimeout(timeout);
            ws.close();
            resolve(Buffer.concat(audioChunks));
          }
        } else {
          // Binary frame — audio data. The first 2 bytes are the header length.
          const raw = Buffer.from(event.data);
          if (raw.length < 2) return;
          const headerLen = raw.readUInt16BE(0);
          const headerEnd = 2 + headerLen;
          if (raw.length > headerEnd) {
            audioChunks.push(raw.slice(headerEnd));
          }
        }
      };

      ws.onerror = (err: Event) => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        } else {
          reject(new Error("TTS closed without audio"));
        }
      };
    });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[TTS] Edge TTS WebSocket failed:", err);
    return NextResponse.json(
      { error: "Text-to-speech synthesis failed. Voice playback unavailable." },
      { status: 500 }
    );
  }
}
