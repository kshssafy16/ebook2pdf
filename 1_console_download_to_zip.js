/*
HTML 전자책 페이지 이미지를 ZIP 하나로 저장하는 Chrome Console 스크립트

사용 방법
1. 전자책을 열고 페이지를 2~3장 넘깁니다.
2. F12 > Console을 엽니다.
3. 이 파일 전체를 붙여넣고 Enter를 누릅니다.
4. 완료되면 ebook_images_페이지수p.zip이 다운로드됩니다.

지원 이미지: JPG, PNG, WebP
전체 페이지 수는 자동으로 찾습니다.
자동 탐지가 잘못될 때만 TOTAL_PAGES_OVERRIDE에 숫자를 입력하세요.
*/

(async () => {
  // null이면 전체 페이지 수 자동 탐지
  // 자동 탐지가 실패할 때만 예: 113으로 변경
  const TOTAL_PAGES_OVERRIDE = null;

  const START_PAGE = 1;
  const REQUEST_DELAY_MS = 1;
  const MAX_RETRIES = 2;
  const MAX_AUTO_PAGES = 3000;

  /*
  페이지 이미지 URL 자동 탐지가 실패할 때만 사용합니다.
  Network에서 page-...-0001.jpg/png/webp 요청을 우클릭하고
  Copy > Copy link address로 복사해 아래 따옴표 안에 넣으세요.
  */
  const SAMPLE_URL = "";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const SUPPORTED_CONTENT_TYPES = new Map([
    ["image/jpeg", ".jpg"],
    ["image/jpg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
  ]);

  function findSampleUrl() {
    if (SAMPLE_URL.trim()) {
      return SAMPLE_URL.trim();
    }

    const urls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name);

    const knownImage = urls.find((url) =>
      /\/page-[^/?]+-\d{4,}\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url)
    );

    if (knownImage) {
      return knownImage;
    }

    return urls.find((url) =>
      /\/page-[^/?]+-\d{4,}(?:\?|$)/i.test(url)
    );
  }

  function getSameOriginDocuments() {
    const documents = [];
    const visited = new Set();

    function visit(targetWindow) {
      try {
        const doc = targetWindow.document;
        if (!doc || visited.has(doc)) {
          return;
        }

        visited.add(doc);
        documents.push(doc);

        for (const frame of doc.querySelectorAll("iframe, frame")) {
          try {
            if (frame.contentWindow) {
              visit(frame.contentWindow);
            }
          } catch {
            // 다른 출처 iframe은 건너뜁니다.
          }
        }
      } catch {
        // 접근할 수 없는 문서는 건너뜁니다.
      }
    }

    visit(window);
    return documents;
  }

  function detectTotalPagesFromScreen() {
    const totals = [];
    const pagePattern = /^\s*(\d{1,5})\s*\/\s*(\d{1,5})\s*$/;

    for (const doc of getSameOriginDocuments()) {
      const elements = doc.querySelectorAll("body *");

      for (const element of elements) {
        if (element.children.length > 0) {
          continue;
        }

        const text = (element.textContent || "").trim();
        if (!text || text.length > 20) {
          continue;
        }

        const match = text.match(pagePattern);
        if (!match) {
          continue;
        }

        const current = Number(match[1]);
        const total = Number(match[2]);

        if (
          Number.isInteger(current) &&
          Number.isInteger(total) &&
          current >= 1 &&
          total >= current &&
          total <= MAX_AUTO_PAGES
        ) {
          totals.push(total);
        }
      }
    }

    return totals.length ? Math.max(...totals) : null;
  }

  function makeCrc32Table() {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
      let value = n;

      for (let k = 0; k < 8; k++) {
        value = (value & 1)
          ? (0xEDB88320 ^ (value >>> 1))
          : (value >>> 1);
      }

      table[n] = value >>> 0;
    }

    return table;
  }

  const CRC32_TABLE = makeCrc32Table();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;

    for (const byte of bytes) {
      crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function getDosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());

    const dosTime =
      ((date.getHours() & 0x1F) << 11) |
      ((date.getMinutes() & 0x3F) << 5) |
      (Math.floor(date.getSeconds() / 2) & 0x1F);

    const dosDate =
      (((year - 1980) & 0x7F) << 9) |
      (((date.getMonth() + 1) & 0x0F) << 5) |
      (date.getDate() & 0x1F);

    return { dosTime, dosDate };
  }

  function createLocalHeader(nameBytes, crc, size, dosTime, dosDate) {
    const buffer = new ArrayBuffer(30 + nameBytes.length);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint32(0, 0x04034B50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    bytes.set(nameBytes, 30);

    return bytes;
  }

  function createCentralHeader(
    nameBytes,
    crc,
    size,
    dosTime,
    dosDate,
    localOffset
  ) {
    const buffer = new ArrayBuffer(46 + nameBytes.length);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint32(0, 0x02014B50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, localOffset, true);
    bytes.set(nameBytes, 46);

    return bytes;
  }

  function createEndRecord(entryCount, centralSize, centralOffset) {
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);

    view.setUint32(0, 0x06054B50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);

    return new Uint8Array(buffer);
  }

  function extensionFromContentType(contentType) {
    const normalized = (contentType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    return SUPPORTED_CONTENT_TYPES.get(normalized) || "";
  }

  async function fetchPage(url, pageNumber, allowEnd = false) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (allowEnd && [404, 410].includes(response.status)) {
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        const extension = extensionFromContentType(contentType);

        if (!extension) {
          if (allowEnd) {
            return null;
          }
          throw new Error(`지원하지 않는 이미지 형식: ${contentType || "unknown"}`);
        }

        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          extension,
        };
      } catch (error) {
        lastError = error;

        if (attempt <= MAX_RETRIES) {
          console.warn(
            `[${pageNumber}] 요청 재시도 (${attempt}/${MAX_RETRIES})`,
            error
          );
          await sleep(300 * attempt);
        }
      }
    }

    throw lastError;
  }

  const sample = findSampleUrl();

  if (!sample) {
    throw new Error(
      "페이지 이미지 주소를 찾지 못했습니다. " +
      "페이지를 2~3장 넘긴 뒤 다시 실행하거나 SAMPLE_URL을 입력하세요."
    );
  }

  const sampleUrl = new URL(sample);
  const match = sampleUrl.pathname.match(
    /^(.*-)(\d{4,})(\.(?:jpe?g|png|webp))?$/i
  );

  if (!match) {
    throw new Error(
      `지원하는 페이지 파일명 규칙이 아닙니다: ${sampleUrl.pathname}`
    );
  }

  const prefix = match[1];
  const numberWidth = match[2].length;
  const sampleExtension = (match[3] || "").toLowerCase();
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime();

  let totalPages = Number.isInteger(TOTAL_PAGES_OVERRIDE)
    ? TOTAL_PAGES_OVERRIDE
    : detectTotalPagesFromScreen();

  if (totalPages) {
    console.log(`전체 페이지 자동 확인: ${totalPages}페이지`);
  } else {
    console.log(
      "화면에서 전체 페이지 수를 찾지 못했습니다. " +
      "마지막 이미지까지 자동으로 확인합니다."
    );
  }

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let downloadedCount = 0;
  let lastPage = 0;

  console.log("기준 이미지 URL:", sampleUrl.href);
  console.log("다운로드를 시작합니다. 탭을 닫지 마세요.");

  const pageLimit = totalPages || MAX_AUTO_PAGES;

  for (let page = START_PAGE; page <= pageLimit; page++) {
    const pageText = String(page).padStart(numberWidth, "0");
    const pageUrl = new URL(sampleUrl.href);
    pageUrl.pathname = `${prefix}${pageText}${sampleExtension}`;

    const result = await fetchPage(
      pageUrl.href,
      page,
      totalPages === null
    );

    if (result === null) {
      totalPages = page - 1;
      console.log(`마지막 페이지 자동 확인: ${totalPages}페이지`);
      break;
    }

    const zipName =
      `ebook-${String(page).padStart(4, "0")}${result.extension}`;
    const nameBytes = encoder.encode(zipName);
    const checksum = crc32(result.bytes);

    const localHeader = createLocalHeader(
      nameBytes,
      checksum,
      result.bytes.length,
      dosTime,
      dosDate
    );

    const centralHeader = createCentralHeader(
      nameBytes,
      checksum,
      result.bytes.length,
      dosTime,
      dosDate,
      localOffset
    );

    localParts.push(localHeader, result.bytes);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + result.bytes.length;
    downloadedCount++;
    lastPage = page;

    if (page === START_PAGE || page % 10 === 0 || page === totalPages) {
      console.log(`${page}/${totalPages || "?"}페이지 준비 완료`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (!downloadedCount) {
    throw new Error("다운로드된 페이지가 없습니다.");
  }

  totalPages = totalPages || lastPage;

  if (downloadedCount !== totalPages - START_PAGE + 1) {
    throw new Error(
      `페이지 수 불일치: 예상 ${totalPages}, 실제 ${downloadedCount}`
    );
  }

  const centralOffset = localOffset;
  const centralSize = centralParts.reduce(
    (sum, part) => sum + part.length,
    0
  );

  const endRecord = createEndRecord(
    downloadedCount,
    centralSize,
    centralOffset
  );

  const zipBlob = new Blob(
    [...localParts, ...centralParts, endRecord],
    { type: "application/zip" }
  );

  const objectUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = `ebook_images_${totalPages}p.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

  console.log(
    `완료: ${downloadedCount}페이지를 ebook_images_${totalPages}p.zip으로 저장했습니다.`
  );
})();
