---
marp: true
theme: default
paginate: false
backgroundColor: #fff
size: 16:9
_html: true
style: |
  section {
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h2 {
    color: #2c3e50;
    font-size: 1.4rem;
    margin-bottom: 0.3rem;
    text-align: center;
  }
  .subtitle {
    text-align: center;
    color: #666;
    font-size: 0.75rem;
    margin-bottom: 1rem;
  }
  .architecture-diagram {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 0.5rem;
  }
  .arch-side {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .arch-title {
    font-size: 1rem;
    font-weight: bold;
    margin-bottom: 0.8rem;
    color: #2c3e50;
  }
  .flow-step {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 0.15rem 0;
  }
  .flow-box {
    border: 2px solid #3498db;
    border-radius: 8px;
    padding: 0.5rem 0.8rem;
    background: white;
    width: 200px;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.3;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    min-height: 45px;
  }
  .agent-box {
    background: #e3f2fd;
    border-color: #1976d2;
    color: #1565c0;
  }
  .pep-box {
    background: #fff3cd;
    border-color: #f39c12;
    color: #d68910;
    font-weight: bold;
  }
  .pdp-box {
    background: #f3e5f5;
    border-color: #9c27b0;
    color: #7b1fa2;
  }
  .data-box {
    background: #ffebee;
    border-color: #e53935;
    color: #c62828;
  }
  .flow-arrow {
    font-size: 1.2rem;
    color: #3498db;
    width: 30px;
    text-align: center;
  }
  .step-label {
    font-size: 0.65rem;
    color: #555;
    padding: 0.2rem 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
    white-space: nowrap;
  }
  .note-bottom {
    font-size: 0.65rem;
    color: #666;
    margin-top: 1rem;
    text-align: center;
    line-height: 1.4;
  }
---

## 認可の配置シフト

<div class="subtitle">従来の「境界の一段階チェック」から「ビジネスフロー内の動的ゲート」へ移行する</div>

<div class="architecture-diagram">
  <div class="arch-side">
    <div class="arch-title">従来の配置</div>

    <div class="flow-step">
      <div class="flow-box agent-box">職員 / 業務担当者</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">① 権限の確認</div>
    </div>

    <div class="flow-step">
      <div class="flow-box">業務プログラム<br>(システム全体へ繋ぐ)</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">② API呼び出し / 認証</div>
    </div>

    <div class="flow-step">
      <div class="flow-box data-box">住民情報 / PII</div>
    </div>
  </div>

  <div class="arch-side">
    <div class="arch-title">AGA による配置</div>

    <div class="flow-step">
      <div class="flow-box agent-box">AI Agent<br>(行動を自律的に生成)</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">① Actionごと</div>
    </div>

    <div class="flow-step">
      <div class="flow-box pep-box">PEP<br>(アクションゲート)</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">② ポリシー評価</div>
    </div>

    <div class="flow-step">
      <div class="flow-box pdp-box">PDP<br>(実行前の認可判断)</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">③ ツール実行</div>
    </div>

    <div class="flow-step">
      <div class="flow-box">ツール / ワークフロー</div>
    </div>

    <div class="flow-step">
      <div class="flow-arrow">↓</div>
      <div class="step-label">④ データアクセス</div>
    </div>

    <div class="flow-step">
      <div class="flow-box data-box">住民情報 / PII</div>
    </div>
  </div>
</div>

<div class="note-bottom">ポイント: ビジネスフローと認可判断が分離されており、実行前にアクションゲート(PEP)を必ず通る</div>
