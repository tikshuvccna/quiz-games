#!/usr/bin/env bash
# Makes the music in music/music-prompts.md with Google Flow Music, one prompt at a time (about 4-5 minutes each,
# 2 songs per prompt). Uses the owner's Flow account through the escape-planner tool, so only run it with their OK.
# Resumable: a prompt whose files already exist is skipped; it stops at the first failure.
#   bash scripts/make-music.sh            all prompts that have no files yet
#   bash scripts/make-music.sh m5-3       only tags that start with this
cd "$(dirname "$0")/.." || exit 1
TOOL="E:/esacpe-planner/escaperoom-design/.claude/skills/google-flow/scripts/flow_music.py"
FILE=music/music-prompts.md
ONLY="$1"
for tag in $(grep -o 'flowmusic: [a-z0-9-]*' "$FILE" | sed 's/flowmusic: //'); do
  [ -n "$ONLY" ] && [[ "$tag" != "$ONLY"* ]] && continue
  # m1-3-lobby-island -> M1-3 ; the four first prompts (m1-lobby ...) were made earlier and are skipped
  prefix=$(echo "$tag" | sed -E 's/^m([0-9])-([0-9]+)-.*/M\1-\2/')
  case "$prefix" in M*-*) ;; *) continue ;; esac
  if ls music/"$prefix"-*.mp3 >/dev/null 2>&1; then echo "skip $tag (done)"; continue; fi
  echo "=== $tag -> $prefix"
  python "$TOOL" --prompt-file "$FILE" --tag "$tag" --out music --prefix "$prefix" --format MP3 || { echo "FAILED on $tag"; exit 1; }
done
echo "all done"
