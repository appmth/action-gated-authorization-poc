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
