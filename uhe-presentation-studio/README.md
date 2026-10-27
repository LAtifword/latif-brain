# UHE Presentation Studio

A local-first proposal intake, source review, slide editing, and export tool for Unique Hashtagger Events. It runs on `127.0.0.1`, makes no outbound requests, and stores project inputs/settings/outputs beneath `data/` (ignored by Git).

## Quick start

1. Install Python 3.10+ plus the packages listed in `requirements.txt` while online, and install LibreOffice for PDF export. Install Tesseract if image/PDF OCR is needed. Keep these components installed for offline use.
2. From this directory run `python app.py` (`start.bat` is provided for Windows) and open `http://127.0.0.1:8877`.
3. Select files or a folder, scan the inventory, inspect extraction issues, build a draft, edit slides, save, and export editable PPTX + matching PDF.

Supported inputs: PDF (up to 50 pages per file), DOCX, PPTX, legacy PPT through LibreOffice, XLSX, CSV, TXT/MD, common raster images, SVG, and 3D source formats GLTF/GLB/OBJ/STL/FBX/BLEND. Tesseract OCR is used for images and degraded PDF text if installed. Each extracted fact is linked to its source file and page/slide/paragraph/row reference. Exact duplicate files are flagged. Explicit source labels such as CONFLICT, BLOCKER, and AMBIGUITY are surfaced as review items; differing values are not called conflicts without context. The generator does not invent absent values. 3D formats are inventoried, but this build does not render them.

## Local data and output

- `data/projects/<project>/sources/`: original uploaded inputs; never modified by the builder.
- `data/projects/<project>/inventory.json`: extracted text, locations, hashes, and extraction issues.
- `data/projects/<project>/slides.json`: editable draft slide content and source list.
- `data/projects/<project>/output/`: generated PPTX/PDF.
- `data/profiles/uhe-default.json`: editable UHE default presentation profile.

Folder scans are browser uploads into this local server. A project’s files stay separated by project ID. Upload requests are limited to 200 MB. Never use public network exposure for the local server.

## Saved presentation profiles

The default profile is created at `data/profiles/uhe-default.json` on first launch. The editor can save additional client/project profiles with page format, fonts, colors, sizes, margins, direction, footer, and page numbering. Existing profile values remain editable JSON.

## Model status

This build does not claim generative AI is active. It uses deterministic extraction and source-grounded slide grouping. The inspected `latif-brain` repo has only Chat Agent inference implemented; its Design Agent is metadata-only. The local runtime inspected for this implementation had no GGUF inference engine or verified model weights. No source material is sent to a cloud model. A future local model adapter must be explicitly configured and tested against a local model before it is shown as available.

## Known limits

- The editor supports slide order, add, duplicate, delete, title/body/source edits. It does not yet offer arbitrary drag placement, editable chart construction, animations, or regenerated single-slide AI content. The style selector changes the exported palette. The animation setting is saved as profile metadata but this exporter writes no motion effects.
- Arabic text can be extracted, entered, and saved; source English text is not automatically translated. Paragraph direction is set for Arabic decks, but this version does not guarantee full PowerPoint RTL shaping/fonts. Check Arabic output in the target office suite before client use.
- Legacy `.ppt` is accepted for extraction via LibreOffice conversion; primary output is editable `.pptx` plus PDF. No `.ppt` output is claimed.
- Rendering depends on installed LibreOffice and fonts. Verify the exported deck visually before client issue.
- User-supplied logos/renders are not synthesized. Project-specific approval and revision status must be confirmed by a human.

## Security and offline operation

After dependencies are installed, disconnect from the network and run the server locally. The app has no analytics, remote API, model-download, or external asset dependency. Bind only to loopback (`127.0.0.1`). The UI explicitly labels output as draft and requires human fact/revision review.
