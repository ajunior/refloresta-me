#!/bin/sh
# Roda test.html no Chrome headless e sai com erro se algum teste falhar.
# Uso: test/run.sh   (CHROME=chromium test/run.sh para outro navegador)
set -e
cd "$(dirname "$0")"
CHROME=${CHROME:-google-chrome}
out=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
  --virtual-time-budget=60000 --dump-dom "file://$PWD/test.html" 2>/dev/null \
  | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g' | grep -E '^(PASS|FAIL|RESULT)')
echo "$out"
echo "$out" | grep -q '^RESULT' || { echo "a bateria não terminou"; exit 1; }
! echo "$out" | grep -q '^FAIL'
