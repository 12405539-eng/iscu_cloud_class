import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// shortCode로 원본 URL 조회 (리다이렉트용)
export async function findUrlByShortCode(shortCode) {
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;

  return rows[0]?.original_url ?? null;
}

// originalUrl로 기존 shortCode 조회 (T05: 동일 URL 중복 처리용)
export async function findShortCodeByOriginalUrl(originalUrl) {
  const rows = await sql`
    SELECT short_code
    FROM urls
    WHERE original_url = ${originalUrl}
    LIMIT 1
  `;

  return rows[0]?.short_code ?? null;
}

// 단축 URL DB 저장 (short_code 충돌 방지 포함)
export async function saveUrl(shortCode, originalUrl) {
  await sql`
    INSERT INTO urls (short_code, original_url)
    VALUES (${shortCode}, ${originalUrl})
    ON CONFLICT (short_code) DO NOTHING
  `;
}

// 호환성을 위한 함수 이름 별칭
export const createShortUrl = saveUrl;