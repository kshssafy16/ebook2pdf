# ebook2pdf

## 목적

HTML 전자책의 페이지 이미지를 ZIP으로 내려받고, 하나의 PDF 파일로 변환합니다.
Windows와 macOS(맥북)에서 모두 사용할 수 있습니다.

## 사용 방법

### 1단계: 브라우저에서 ZIP 내려받기 (공통)

1. 전자책에서 페이지를 2~3장 넘깁니다.
2. 개발자 도구 콘솔을 엽니다.
   - Windows Chrome/Edge: `F12` → `Console`
   - macOS Chrome/Edge: `⌘ + ⌥ + J` (Command + Option + J)
   - macOS Safari: 먼저 `Safari > 설정 > 고급`에서 **"웹 개발자를 위한 기능 보기"**(또는 "메뉴 막대에서 개발자용 메뉴 보기")를 켠 뒤 `⌘ + ⌥ + C`
3. `1_console_download_to_zip.js`의 전체 코드를 붙여넣고 실행합니다.
   - Chrome에서 붙여넣기가 막히면 콘솔에 `allow pasting`을 입력한 뒤 다시 붙여넣습니다.

### 2단계: PDF로 변환 — Windows

1. 최초 1회 `2_install_img2pdf.bat`을 실행합니다.
2. `3_run_pdf_conversion.bat`을 실행합니다.

### 2단계: PDF로 변환 — macOS

1. Python 3가 필요합니다. 없다면 다음 중 하나로 설치합니다.
   - [python.org](https://www.python.org/downloads/macos/) 설치 파일
   - Homebrew: `brew install python`
2. 최초 1회 `2_install_img2pdf.command`를 Finder에서 더블클릭합니다.  
   (이 폴더 안에 `.venv` 가상환경을 만들고 `img2pdf`를 설치합니다.)
3. `3_run_pdf_conversion.command`를 더블클릭합니다.

터미널에서 실행해도 됩니다.

```bash
cd ~/Downloads/ebook2pdf   # 이 저장소를 받은 폴더
./2_install_img2pdf.command
./3_run_pdf_conversion.command
```

#### macOS에서 실행이 안 될 때

- **"확인되지 않은 개발자" / "열 수 없습니다"** 경고가 뜨면  
  파일을 `Control + 클릭(우클릭) → 열기`로 한 번 열거나,
  `시스템 설정 > 개인정보 보호 및 보안`에서 **"그래도 열기"**를 누릅니다.  
  또는 터미널에서 격리 속성을 제거합니다.

  ```bash
  xattr -d com.apple.quarantine *.command
  ```

- **"권한이 없습니다"(Permission denied)** 가 뜨면 실행 권한을 부여합니다.

  ```bash
  chmod +x *.command
  ```

## ZIP 파일 위치

다운로드된 ZIP은 다음 위치 중 하나에 두면 됩니다.

- 변환 도구 폴더  
  `3_make_pdf.py`가 있는 폴더
- `Downloads`(다운로드) 폴더 (Windows / macOS 공통)

여러 ZIP이 있으면 각각 PDF로 변환합니다.

Safari의 "다운로드 후 '안전한' 파일 열기" 옵션 때문에 ZIP이 자동으로
`ebook_images_113p` 같은 폴더로 풀려도 그대로 변환됩니다.

## 결과

```text
ebook_images_113p.zip
→ ebook_113p.pdf
```

생성된 PDF는 원본 ZIP과 같은 폴더에 저장됩니다.
같은 이름의 PDF가 이미 있으면 건너뜁니다.

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
