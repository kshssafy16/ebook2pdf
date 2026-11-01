#!/bin/bash
# macOS용 PDF 변환 실행 스크립트 (Finder에서 더블클릭하거나 터미널에서 실행)

cd "$(dirname "$0")" || exit 1

if [ -x ".venv/bin/python" ]; then
    exec .venv/bin/python "3_make_pdf.py"
fi

for candidate in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
        exec "$candidate" "3_make_pdf.py"
    fi
done

echo "Python 3를 찾지 못했습니다."
echo "먼저 2_install_img2pdf.command를 실행하세요."
echo
read -r -p "Enter를 누르면 종료합니다..." _
exit 1
