"""
ebook_images_*.zip 파일을 PDF로 변환합니다.
여러 ZIP이 있으면 각각 처리하고, 한 파일이 실패해도 다음 파일을 계속 처리합니다.

Windows와 macOS에서 모두 동작합니다.
macOS Safari처럼 ZIP을 자동으로 풀어버리는 경우를 위해
ebook_images_*p 폴더도 함께 처리합니다.
"""

from __future__ import annotations

import platform
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

IS_MAC = platform.system() == "Darwin"
INSTALL_SCRIPT = "2_install_img2pdf.command" if IS_MAC else "2_install_img2pdf.bat"


def wait_for_enter() -> None:
    """창이 바로 닫히지 않도록 대기합니다. 입력이 없는 환경에서는 건너뜁니다."""
    if not sys.stdin or not sys.stdin.isatty():
        return
    try:
        input("Enter를 누르면 종료합니다...")
    except (EOFError, KeyboardInterrupt):
        pass


try:
    import img2pdf
except ImportError:
    print("img2pdf가 설치되어 있지 않습니다.")
    print(f"{INSTALL_SCRIPT}을 먼저 실행하세요.")
    wait_for_enter()
    raise SystemExit(1)

ZIP_PATTERN = "ebook_images_*.zip"
IMAGE_PATTERN = re.compile(
    r"^ebook-(\d+)\.(jpe?g|png|webp)$",
    re.IGNORECASE,
)
ZIP_NAME_PATTERN = re.compile(
    r"^ebook_images_(\d+)p(?:\s*\((\d+)\))?\.zip$",
    re.IGNORECASE,
)
# Safari가 ZIP을 자동으로 풀었을 때 생기는 폴더 이름 (예: ebook_images_113p, ebook_images_113p 2)
FOLDER_PATTERN = "ebook_images_*"
FOLDER_NAME_PATTERN = re.compile(
    r"^ebook_images_(\d+)p(?:\s*\(?(\d+)\)?)?$",
    re.IGNORECASE,
)


def candidate_folders() -> list[Path]:
    folders = [Path(__file__).resolve().parent, Path.cwd()]
    downloads = Path.home() / "Downloads"

    if downloads.exists():
        folders.append(downloads)

    unique: list[Path] = []
    for folder in folders:
        resolved = folder.resolve()
        if resolved not in unique:
            unique.append(resolved)

    return unique


def find_zip_candidates() -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()

    for folder in candidate_folders():
        found = list(folder.glob(ZIP_PATTERN))
        found += [
            path
            for path in folder.glob(FOLDER_PATTERN)
            if path.is_dir() and FOLDER_NAME_PATTERN.fullmatch(path.name)
        ]

        for candidate in found:
            resolved = candidate.resolve()
            if resolved not in seen:
                seen.add(resolved)
                candidates.append(candidate)

    return sorted(candidates, key=lambda path: (str(path.parent), path.name))


def zip_metadata(zip_path: Path) -> tuple[int | None, str]:
    pattern = FOLDER_NAME_PATTERN if zip_path.is_dir() else ZIP_NAME_PATTERN
    match = pattern.fullmatch(zip_path.name)

    if not match:
        return None, "ebook.pdf"

    page_count = int(match.group(1))
    suffix = match.group(2)

    if suffix:
        return page_count, f"ebook_{page_count}p ({suffix}).pdf"

    return page_count, f"ebook_{page_count}p.pdf"


def extract_images_from_zip(
    zip_path: Path,
    temp_folder: Path,
) -> list[tuple[int, Path]]:
    extracted: list[tuple[int, Path]] = []

    with zipfile.ZipFile(zip_path, "r") as archive:
        for info in archive.infolist():
            safe_name = Path(info.filename).name
            match = IMAGE_PATTERN.fullmatch(safe_name)

            if not match:
                continue

            page_number = int(match.group(1))
            output_path = temp_folder / safe_name

            with archive.open(info, "r") as source:
                output_path.write_bytes(source.read())

            extracted.append((page_number, output_path))

    extracted.sort(key=lambda item: item[0])
    return extracted


def collect_images_from_folder(folder: Path) -> list[tuple[int, Path]]:
    collected: list[tuple[int, Path]] = []

    for path in folder.rglob("*"):
        if not path.is_file():
            continue

        match = IMAGE_PATTERN.fullmatch(path.name)
        if match:
            collected.append((int(match.group(1)), path))

    collected.sort(key=lambda item: item[0])
    return collected


def validate_pages(
    images: list[tuple[int, Path]],
    declared_page_count: int | None,
) -> None:
    if not images:
        raise RuntimeError("변환할 이미지가 없습니다.")

    numbers = [number for number, _ in images]

    if len(numbers) != len(set(numbers)):
        raise RuntimeError("중복된 페이지 번호가 있습니다.")

    if numbers[0] != 1:
        raise RuntimeError(f"첫 페이지가 0001이 아닙니다: {numbers[0]:04d}")

    expected = set(range(1, numbers[-1] + 1))
    missing = sorted(expected - set(numbers))

    if missing:
        text = ", ".join(f"{number:04d}" for number in missing)
        raise RuntimeError(f"누락된 페이지가 있습니다: {text}")

    if declared_page_count is not None and len(images) != declared_page_count:
        raise RuntimeError(
            f"페이지 수 불일치: ZIP 파일명 {declared_page_count}p, "
            f"실제 {len(images)}장"
        )


def convert_zip(zip_path: Path) -> tuple[str, Path]:
    declared_page_count, output_name = zip_metadata(zip_path)
    output_path = zip_path.parent / output_name

    if output_path.exists():
        return "skip", output_path

    with tempfile.TemporaryDirectory(prefix="ebook2pdf_") as temp:
        if zip_path.is_dir():
            images = collect_images_from_folder(zip_path)
        else:
            images = extract_images_from_zip(zip_path, Path(temp))
        validate_pages(images, declared_page_count)

        temp_output = Path(temp) / output_name
        with temp_output.open("wb") as output:
            output.write(
                img2pdf.convert(
                    [str(path) for _, path in images],
                    rotation=img2pdf.Rotation.ifvalid,
                )
            )
        shutil.move(str(temp_output), str(output_path))

    return "success", output_path


def main() -> int:
    zip_candidates = find_zip_candidates()

    if not zip_candidates:
        print("ebook_images_*.zip 파일(또는 압축이 풀린 폴더)을 찾지 못했습니다.")
        print("ZIP은 이 폴더 또는 Downloads(다운로드) 폴더에 두세요.")
        return 1

    print(f"발견된 ZIP/폴더: {len(zip_candidates)}개")

    successes: list[tuple[Path, Path]] = []
    skipped: list[tuple[Path, Path]] = []
    failures: list[tuple[Path, str]] = []

    for zip_path in zip_candidates:
        print()
        print(f"처리 중: {zip_path.name}")

        try:
            status, output_path = convert_zip(zip_path)

            if status == "skip":
                skipped.append((zip_path, output_path))
                print(f"건너뜀: {output_path.name}이 이미 있습니다.")
            else:
                successes.append((zip_path, output_path))
                print(f"완료: {output_path}")
        except Exception as error:
            failures.append((zip_path, str(error)))
            print(f"실패: {error}")

    print()
    print("===== 처리 결과 =====")
    print(f"성공: {len(successes)}개")
    print(f"건너뜀: {len(skipped)}개")
    print(f"실패: {len(failures)}개")

    if failures:
        print()
        for zip_path, reason in failures:
            print(f"- {zip_path.name}: {reason}")

    return 1 if failures else 0


if __name__ == "__main__":
    try:
        exit_code = main()
    except Exception as error:
        print()
        print(f"오류: {error}")
        exit_code = 1

    print()
    wait_for_enter()
    sys.exit(exit_code)
