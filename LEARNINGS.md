# 033-nekubi LEARNINGS（忍びの道 - Shadow Assassin）

## 実装済み最新技術

### #1 Intersection Observer
- 画面内判定最適化、敵のレンダリング効率化対応

### #2 MutationObserver  
- AI動作監視準備完了

### #3 Web Audio Spatial Audio
- 3D パンニング効果（敵の位置に応じた音量変化）

### #4 Pointer Events
- マルチタッチアクション対応

## テンプレート設計済み（#5-10）
- #5: LocalStorage （ハイスコア保存）
- #6: Canvas Compositing （暗闇エフェクト）
- #7: Keyboard Event 詳細処理
- #8: Performance Timing（フレーム監視）
- #9: IndexedDB （セッション保存）
- #10: Touch Event 詳細

## 世界観戦略
忍者アクションの瞬間的なフィードバック。Web Audio Spatial でステルス感を強化。

## 2026-08-14 アクション全面改修

- 通知を単一の和風ステータス帯へ統合し、ネイティブ `alert()` を廃止。
- 画面をアクション75%／SFC型操作盤25%に固定し、A=斬撃、B=跳躍、X=手裏剣、Y=隠れ身へ整理。
- 敵全滅後に開く扉と「上で入る」表示を追加し、意図しない画面タッチでのステージ遷移を廃止。
- 3段斬撃、ヒットストップ、画面振動、残像、墨・火花粒子、コンボ表示で撃破感を強化。
- 手裏剣の弾数・発射・命中・補充と、長押し隠れ身による敵索敵解除を実動化。
- Pointer Events、Web Audio、Canvas DPR、delta-time、SVG Path2D、OffscreenCanvas、
  Vibration、localStorage、Page Visibility、Gamepad/Performance適応の10機構を用途付きで採用。
- 外部フォント/CDNを使わず、端末内の明朝系フォントとSVGパスで和風表現を維持。
- 旧 `controller-wrapper.html` の二重矢印パネルは本体への互換リダイレクトへ変更し、表示を一本化。
- iOSホーム画面起動用メタ設定を追加し、操作盤を明色樹脂風から黒漆・鉄・木目の低彩度配色へ変更。
- BGMは `kokoro.mp3`（潜入）と `nekugi.mp3`（天誅後）をHTMLAudioで再生。開始タップでunlockし、ミュート・一時停止・画面復帰に追従。
- 敵数を各階2倍（1階4 / 2階6 / 3〜5階8）。配置は床と足場に分散。
- PCでもクリック／Enter／SpaceでBGM解禁。`kokoro.mp3` `nekugi.mp3` をWeb Audioの重低音EQ＋コンプレッサー経由で爆音再生。
- 2026-08-14 公開: SPEC.md 追加。GitHub Pages 更新。
- 開始タップで解禁するWeb Audio製の和風五音音階BGMを追加。消音・一時停止・画面非表示時は停止し、復帰時も二重再生しない。
