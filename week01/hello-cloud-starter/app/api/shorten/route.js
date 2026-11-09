import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { saveUrl, findShortCodeByOriginalUrl } from "../../../lib/db";

export const runtime = "nodejs";

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256")
    .update(originalUrl)
    .digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16
    );

    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {
    /*
     * 요청 body 읽기
     */
    const body = await request.json().catch(() => null);

    const raw = body?.originalUrl;
    const originalUrl =
      typeof raw === "string" ? raw.trim() : "";

    /*
     * 2. URL이 입력되지 않은 경우 (T03)
     */
    if (!originalUrl) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_URL",
            message: "Original URL is required.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 3. URL이 너무 긴 경우
     */
    if (originalUrl.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        {
          error: {
            code: "URL_TOO_LONG",
            message:
              `URL must be ${MAX_URL_LENGTH} characters or fewer.`,
          },
        },
        { status: 400 }
      );
    }

    /*
     * 4. URL 형식 검사 (T04)
     */
    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message:
              "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 5. 프로토콜 검사 (T04)
     */
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message:
              "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }

    /*
     * 자기 서비스 URL 단축 방지
     */
    const requestHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      new URL(request.url).host;

    const currentHostname = requestHost.split(":")[0].toLowerCase();
    const targetHostname = parsedUrl.hostname.toLowerCase();

    if (currentHostname === targetHostname) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: "Cannot shorten self-service URL.",
          },
        },
        { status: 400 }
      );
    }

    // baseUrl 조립
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${requestHost}`;

    /*
     * 동일 URL 중복 처리
     */
    const existingCode = await findShortCodeByOriginalUrl(originalUrl);
    if (existingCode) {
      return NextResponse.json(
        {
          shortCode: existingCode,
          shortUrl: `${baseUrl}/${existingCode}`,
          originalUrl,
        },
        { status: 200 }
      );
    }

    //Short URL 신규 생성
    const shortCode = createShortCode(originalUrl);

    await saveUrl(shortCode, originalUrl);

    //URL 생성 성공
    return NextResponse.json(
      {
        shortCode,
        shortUrl: `${baseUrl}/${shortCode}`,
        originalUrl,
      },
      { status: 201 }
    );

  } catch {
    /*
     * 7. 서버 내부 오류
     */
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create short URL.",
        },
      },
      { status: 500 }
    );
  }
}