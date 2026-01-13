---
theme: default
background: '#ffffff'
highlighter: shiki
lineNumbers: false
transition: slide-left
title: 認可の配置シフト
---

# 認可の配置シフト

<div class="text-sm opacity-60 mt-4">
従来の「境界の一段階チェック」から「ビジネスフロー内の動的ゲート」へ移行する
</div>

---

# AI Agent時代の認可アーキテクチャ

![AI Agent時代の認可アーキテクチャ - 業務フローから「認可」を分離すべき理由](../03-images/authorization-placement/AI_Agent_Authorization_Placement-01.png)
*業務フローから「認可」を分離すべき理由*

---

# 従来の世界：人間中心の実行経路

![従来の世界 - 固定・予測可能な実行経路](../03-images/authorization-placement/AI_Agent_Authorization_Placement-02.png)
*人間による操作は固定・予測可能（Fixed・Predictable）*

---

# AI Agentの登場：実行経路の非決定性

![AI Agentの登場 - 動的・非決定的な実行経路](../03-images/authorization-placement/AI_Agent_Authorization_Placement-03.png)
*AI Agentによる実行経路は動的・非決定的（Dynamic・Non-deterministic）*

---

# 境界型認可の限界

![境界型認可の限界 - 業務的な妥当性は保証できない](../03-images/authorization-placement/AI_Agent_Authorization_Placement-04.png)
*例：「ゴミ収集日」の問い合わせに対し、不要な「世帯情報・納税情報」まで取得してしまうケース*

---

# 説明責任の構造的崩壊

![説明責任の構造的崩壊 - Before/After比較](../03-images/authorization-placement/AI_Agent_Authorization_Placement-05.png)
*地方自治体では『アクセスできたか』よりも『なぜその情報に触れる必要があったのかを説明できるか』が常に問われる*

---

# AIへの責任転嫁は通用しない

![AIへの責任転嫁は通用しない](../03-images/authorization-placement/AI_Agent_Authorization_Placement-06.png)
*求められるのは、事後説明ではなく、事前に防ぐ設計*

---

# 問題はモデルではなく「配置」にある

![問題はモデルではなく配置にある](../03-images/authorization-placement/AI_Agent_Authorization_Placement-07.png)
*RBAC/ABACの配置が適切でないとAccountability Gap、適切ならControl Restored*

---

# 基本構造：判断(PDP)と実行(PEP)の分離

![PDP/PEP基本構造](../03-images/authorization-placement/AI_Agent_Authorization_Placement-08.png)
*PDP: 判断（考える責務）、PEP: 強制（止める責務）*

---

# 提案：Action-Gated Authorization (AGA)

![AGA提案 - Actionごとに認可ゲートを通過](../03-images/authorization-placement/AI_Agent_Authorization_Placement-09.png)
*AI Agentの各Actionに対して、PEP → PDP → ツール実行の流れを強制*

---

# 思考と実行の分離：3つの配置パターン

![思考と実行の分離 - 従来/よくあるAI配置/AGAによる配置](../03-images/authorization-placement/AI_Agent_Authorization_Placement-10.png)
*よくあるAI配置では「AIが不要なPIIにアクセスしても止められない」問題が発生*

---

# 「賢いAI」以上に「破綻しない業務構造」が重要

![賢いAI以上に破綻しない業務構造が重要](../03-images/authorization-placement/AI_Agent_Authorization_Placement-11.png)
*AIの賢さよりも、構造としての堅牢性を優先すべき*

---

# Call to Action for Your Role

![各役割へのCall to Action](../03-images/authorization-placement/AI_Agent_Authorization_Placement-12.png)
*プロダクトエンジニア・セキュリティ担当・組織設計者それぞれの視点*

---

# 参考：PDP/PEPアーキテクチャ全体図

![PDP/PEPアーキテクチャ全体図](../03-images/authorization-placement/PDPPEP_architecture.png)
*認可サービスの標準的なアーキテクチャ（PAP, PIP, Attribute Repository含む）*

---

<div class="grid grid-cols-3 gap-4 px-4 mb-4">

<!-- 従来の配置 -->
<div class="flex flex-col items-center">
<div style="height: 40px; display: flex; align-items: center; justify-content: center;">
  <h3 class="text-center text-sm font-bold">従来の配置</h3>
</div>
<div style="height: 48px; display: flex; align-items: center; justify-content: center;">
  <p class="text-xs text-center opacity-70 px-2">人間が操作し、境界で権限を確認する</p>
</div>

<div class="flex flex-col items-center gap-1">

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #f5f5f5; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
職員 / 業務担当者
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">① 権限の確認</div>
</div>

<div style="border: 2px solid #666; border-radius: 6px; padding: 8px 12px; background: white; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
  <div style="font-weight: bold;">業務プログラム</div>
  <div style="font-size: 10px; opacity: 0.7;">(システム全体へ繋ぐ)</div>
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">② api呼び出し / 認証</div>
</div>

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #e8e8e8; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
住民情報 / PII
</div>

</div>
</div>

<!-- よくある AI Agent の配置 -->
<div class="flex flex-col items-center">
<div style="height: 40px; display: flex; align-items: center; justify-content: center;">
  <h3 class="text-center font-bold" style="font-size: 22px;">よくある AI Agent の配置</h3>
</div>
<div style="height: 48px; display: flex; align-items: center; justify-content: center;">
  <p class="text-xs text-center opacity-70 px-2">AI が行動を生成するが、認可は境界のまま</p>
</div>

<div class="flex flex-col items-center gap-1">

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #f5f5f5; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
  <div style="font-weight: bold;">AI Agent</div>
  <div style="font-size: 10px; opacity: 0.7;">(行動を自律的に生成)</div>
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">① 行動を選択</div>
</div>

<div style="border: 2px solid #666; border-radius: 6px; padding: 8px 12px; background: white; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
ツール / ワークフロー
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">② 境界で認証</div>
</div>

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #e8e8e8; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
住民情報 / PII
</div>

<div style="margin-top: 8px; padding: 8px 10px; background: #fff8e1; border-left: 3px solid #f57c00; font-size: 10px; color: #e65100; line-height: 1.3; width: 160px; font-weight: 600;">
⚠️ AI が不要な PII にアクセスしても止められない
</div>

</div>
</div>

<!-- AGA による配置 -->
<div class="flex flex-col items-center">
<div style="height: 40px; display: flex; align-items: center; justify-content: center;">
  <h3 class="text-center text-sm font-bold">AGA による配置</h3>
</div>
<div style="height: 48px; display: flex; align-items: center; justify-content: center;">
  <p class="text-xs text-center opacity-70 px-2">行動ごとに認可ゲートを通過させる</p>
</div>

<div class="flex flex-col items-center gap-1">

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #f5f5f5; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
  <div style="font-weight: bold;">AI Agent</div>
  <div style="font-size: 10px; opacity: 0.7;">(行動を自律的に生成)</div>
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">① Actionごと</div>
</div>

<div style="border: 2px solid #000; border-radius: 6px; padding: 8px 12px; background: #fff; color: #000; text-align: center; font-size: 13px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.12); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
  <div style="font-weight: bold;">PEP</div>
  <div style="font-size: 10px; opacity: 0.7; font-weight: normal;">(アクションゲート)</div>
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">② ポリシー評価</div>
</div>

<div style="border: 2px solid #000; border-radius: 6px; padding: 8px 12px; background: #fff; color: #000; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.12); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
  <div style="font-weight: bold;">PDP</div>
  <div style="font-size: 10px; opacity: 0.7;">(実行前の認可判断)</div>
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">③ ツール実行</div>
</div>

<div style="border: 2px solid #666; border-radius: 6px; padding: 8px 12px; background: white; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
ツール / ワークフロー
</div>

<div class="flex items-center gap-2">
  <div style="font-size: 20px; color: #333; width: 24px; text-align: center;">↓</div>
  <div style="font-size: 10px; color: #666; white-space: nowrap;">④ データアクセス</div>
</div>

<div style="border: 2px solid #333; border-radius: 6px; padding: 8px 12px; background: #e8e8e8; color: #333; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 160px;">
住民情報 / PII
</div>

</div>
</div>

</div>

<div class="text-center opacity-70 mt-1" style="font-size: 10px; line-height: 1.4;">
ポイント: ビジネスフローと認可判断が分離されており、実行前にアクションゲート(PEP)を必ず通る
</div>
