#!/bin/bash
# macOS용 img2pdf 설치 스크립트 (Finder에서 더블클릭하거나 터미널에서 실행)
# Homebrew Python 등은 시스템 전역 pip 설치를 막기 때문에(PEP 668)
# 이 폴더 안에 .venv 가상환경을 만들어 img2pdf를 설치합니다.

cd "$(dirname "$0")" || exit 1

pause() {
    echo
    read -r -p "Enter를 누르면 종료합니다..." _
}

echo "img2pdf를 설치합니다..."
echo

PYTHON=""
for candidate in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >/dev/null 2>&1; then
        PYTHON="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Python 3를 찾지 못했습니다."
    echo "다음 중 한 가지 방법으로 설치한 뒤 다시 실행하세요."
    echo "  - https://www.python.org/downloads/macos/ 에서 설치"
    echo "  - Homebrew: brew install python"
    echo "  - Xcode 명령어 도구: xcode-select --install"
    pause
    exit 1
fi

echo "사용할 Python: $("$PYTHON" --version 2>&1) ($PYTHON)"
echo

if [ ! -x ".venv/bin/python" ]; then
    echo "가상환경(.venv)을 만드는 중..."
    if ! "$PYTHON" -m venv .venv; then
        echo
        echo "가상환경을 만들지 못했습니다."
        pause
        exit 1
    fi
fi

if ! .venv/bin/python -m pip install --upgrade pip >/dev/null 2>&1; then
    echo "pip 업그레이드는 건너뜁니다."
fi

if ! .venv/bin/python -m pip install img2pdf; then
    echo
    echo "설치에 실패했습니다."
    pause
    exit 1
fi

echo
echo "설치가 완료되었습니다."
echo "다음으로 3_run_pdf_conversion.command를 실행하세요."
pause
