---
name: build-lesson
description: Build a quiz, a lesson (slides + PDF pages + activities in the flow) or a study set for the BrainBlast quiz-games program from a topic or the teacher's material, and import it into the running program. Use when the user asks to make a quiz, lesson, presentation, slides with questions, or a study set for this project.
---

# Build a quiz / lesson / study set for BrainBlast

The full rules live in `docs/CLAUDE_PROJECT_INSTRUCTIONS.md`. **Read it first and follow it exactly**: it is the same instructions the teachers' claude.ai Project uses. This skill only adds what you can do on this computer.

## 1. Ask first
Before building anything, ask the teacher (one message, numbered options) what they want, as STEP 0 of the instructions says: the kind of activity (regular quiz · slides only · slides + understanding checks · slides + light involvement · a mixed lesson with something fun · a study set), the material, audience, language, length, how often an activity should come, pictures and videos. Do not build before the kind of activity is known.

## 2. Build the file
- Make the Excel sheet (one row per step) with Python `openpyxl` (or `exceljs`), the columns and type names exactly as the instructions list them, and run the checks the instructions require in code.
- Pictures: draw the ones the teacher agreed to as PNG (Python + matplotlib / Pillow). Look at each picture before delivering.
- PDFs the teacher gave you: read them (do not retype them), reference pages in the `Pdf` column, and copy the file into `pdf/` in the zip under the same name.
- Interactive pages (simulations, animations, small games) are `html` rows: write each as ONE self-contained, offline, Hebrew RTL HTML file, follow "HTML activities" in the instructions and the examples in `examples/html/`, put it in `html/` in the zip, and name it in the `Html` column (`file.html` or `file.html|phones`). Open it in a browser tool and click its controls before delivering.
- Deliver one `.zip`: `lesson.xlsx` + `images/` + `pdf/` + `html/`. Save it in the project's scratchpad or a folder the user names.

## 3. Flow images and videos (only on this computer, only with permission)
More or richer pictures and short videos can be made with Google Flow, but that uses the teacher's Google account. **Ask first, and only use a Flow tool that is actually available in this environment.** Do not guess a tool or a script path, and never run one that logs in to an account without a clear yes. The Flow *music* tool is described in `CLAUDE.md`; it is not an image tool. If no image/video Flow tool is available, say so and use the pictures you can draw yourself. Put any generated picture in `images/` and reference it from the sheet like any other picture.

## 4. Check it imports
- If the program is running (`http://localhost:3000`), you may import the zip yourself: `curl -s -X POST --data-binary @file.zip -H "Content-Type: application/octet-stream" "http://localhost:3000/api/q/import?title=<name>"`. The reply lists what was imported and every problem; fix the file and import again if anything was skipped that should not have been. Do not import into a library the teacher did not expect: tell them where it went.
- If it is not running, do not start the user's server. Give the file and say: in the editor press **⬆ ייבוא קובץ**, pick the file, then **▶ הצגה** to present a lesson.
- To test without touching the real library, use a separate server: `PORT=3100 QUIZ_DIR=<temp folder> REPORTS_DIR=<temp folder> node server/index.js`.

## 5. Report
Say in a few lines: the kind of activity, the topic, the counts (slides, PDF pages, activities, fun steps, questions, estimated minutes), what you assumed, and the import instruction. Do not paste all the content unless asked.
