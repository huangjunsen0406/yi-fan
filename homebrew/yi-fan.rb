# Homebrew Cask for 易翻 (yi-fan)
#
# Official-style formula for a personal/org tap:
#   brew tap <you>/yi-fan https://github.com/<you>/homebrew-yi-fan
#   brew install --cask yi-fan
#
# Or install from this repo path (after a release exists):
#   brew install --cask ./homebrew/yi-fan.rb
#
# Update sha256 after each release:
#   pnpm homebrew:cask
# (see scripts/update-homebrew-cask.mjs)

cask "yi-fan" do
  arch arm: "aarch64", intel: "x64"

  version "0.2.3"
  # Prefer exact hashes from GitHub Release assets. :no_check is fallback only.
  sha256 arm:   "REPLACE_WITH_AARCH64_DMG_SHA256",
         intel: "REPLACE_WITH_X64_DMG_SHA256"

  url "https://github.com/huangjunsen0406/yi-fan/releases/download/v#{version}/yi-fan_#{version}_#{arch}.dmg"
  name "易翻"
  desc "Lightweight multi-engine translator for macOS (Tauri)"
  homepage "https://github.com/huangjunsen0406/yi-fan"

  livecheck do
    url "https://github.com/huangjunsen0406/yi-fan/releases/latest"
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"

  app "易翻.app"

  zap trash: [
    "~/Library/Application Support/com.junsen.yi-fan",
    "~/Library/Caches/com.junsen.yi-fan",
    "~/Library/Preferences/com.junsen.yi-fan.plist",
    "~/Library/WebKit/com.junsen.yi-fan",
  ]
end
