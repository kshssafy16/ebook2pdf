# ebook2pdf

## 목적

HTML 전자책의 페이지 이미지를 ZIP으로 내려받고, 하나의 PDF 파일로 변환합니다.

## 사용 방법

1. 전자책에서 페이지를 2~3장 넘깁니다.
2. `F12 > Console`을 엽니다.
3. `1_console_download_to_zip.js`의 전체 코드를 붙여넣고 실행합니다.
4. 최초 1회 `2_install_img2pdf.bat`을 실행합니다.
5. `3_run_pdf_conversion.bat`을 실행합니다.

다운로드된 ZIP은 다음 위치 중 하나에 두면 됩니다.

- 변환 도구 폴더  
  `3_make_pdf.py`와 `3_run_pdf_conversion.bat`이 있는 폴더
- Windows `Downloads` 폴더

여러 ZIP이 있으면 각각 PDF로 변환합니다.

## 결과

```text
ebook_images_113p.zip
→ ebook_113p.pdf
```

생성된 PDF는 원본 ZIP과 같은 폴더에 저장됩니다.

## 지원 형식

- JPG / JPEG
- PNG
- WebP

전체 페이지 수는 자동으로 확인합니다.

자동 탐지가 잘못될 때만 `1_console_download_to_zip.js` 상단에서 직접 지정합니다.

```js
const TOTAL_PAGES_OVERRIDE = 113;
```

기본값 `null`은 자동 탐지입니다.