#!/usr/bin/env bash
# Generate icon assets for the Next Up Live Activity widget:
# - FitNudgeLogo @1x, @2x, @3x
# - AppIcon.appiconset (all sizes for widget extension)
#
# Usage: ./scripts/generate-fitnudge-logo-assets.sh [source.png]
# Default source: assets/icon.png

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE="${1:-$MOBILE_DIR/assets/icon.png}"

if [[ ! -f "$SOURCE" ]]; then
  echo "Error: Source image not found: $SOURCE"
  exit 1
fi

echo "Source: $SOURCE"
echo ""

# --- FitNudgeLogo.imageset (Live Activity logo) ---
IMAGESET_DIR="$MOBILE_DIR/targets/nextup-live-activity/Assets.xcassets/FitNudgeLogo.imageset"
echo "Generating FitNudgeLogo@1x, @2x, @3x..."
sips -z 44 44 "$SOURCE" --out "$IMAGESET_DIR/FitNudgeLogo@1x.png"
sips -z 88 88 "$SOURCE" --out "$IMAGESET_DIR/FitNudgeLogo@2x.png"
sips -z 132 132 "$SOURCE" --out "$IMAGESET_DIR/FitNudgeLogo@3x.png"
echo "  Done: FitNudgeLogo.imageset"
echo ""

# --- AppIcon.appiconset (widget extension icon) ---
APPICON_DIR="$MOBILE_DIR/targets/nextup-live-activity/Assets.xcassets/AppIcon.appiconset"
echo "Generating AppIcon.appiconset..."
sips -z 20 20 "$SOURCE" --out "$APPICON_DIR/App-Icon-20x20@1x.png"
sips -z 40 40 "$SOURCE" --out "$APPICON_DIR/App-Icon-20x20@2x.png"
sips -z 60 60 "$SOURCE" --out "$APPICON_DIR/App-Icon-20x20@3x.png"
sips -z 29 29 "$SOURCE" --out "$APPICON_DIR/App-Icon-29x29@1x.png"
sips -z 58 58 "$SOURCE" --out "$APPICON_DIR/App-Icon-29x29@2x.png"
sips -z 87 87 "$SOURCE" --out "$APPICON_DIR/App-Icon-29x29@3x.png"
sips -z 40 40 "$SOURCE" --out "$APPICON_DIR/App-Icon-40x40@1x.png"
sips -z 80 80 "$SOURCE" --out "$APPICON_DIR/App-Icon-40x40@2x.png"
sips -z 120 120 "$SOURCE" --out "$APPICON_DIR/App-Icon-40x40@3x.png"
sips -z 120 120 "$SOURCE" --out "$APPICON_DIR/App-Icon-60x60@2x.png"
sips -z 180 180 "$SOURCE" --out "$APPICON_DIR/App-Icon-60x60@3x.png"
sips -z 76 76 "$SOURCE" --out "$APPICON_DIR/App-Icon-76x76@1x.png"
sips -z 152 152 "$SOURCE" --out "$APPICON_DIR/App-Icon-76x76@2x.png"
sips -z 167 167 "$SOURCE" --out "$APPICON_DIR/App-Icon-83.5x83.5@2x.png"
cp "$SOURCE" "$APPICON_DIR/ItunesArtwork@2x.png"
echo "  Done: AppIcon.appiconset"
echo ""

echo "All done."
