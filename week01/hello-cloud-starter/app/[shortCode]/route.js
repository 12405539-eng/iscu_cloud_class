import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = await findUrlByShortCode(shortCode);

  // 존재하지 않는 shortCode의 로그 남기기
  if (!originalUrl) {
    console.warn("Short URL not found", { shortCode });
    return new Response("Not Found", { status: 404 });
  }

  // Redirect에서 클릭 기록하기
  try {
    await recordClick(shortCode);
  } catch (error) {
    console.error("Failed to record click", { shortCode });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}