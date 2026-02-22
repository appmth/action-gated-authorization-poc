# Judgment Demo Slides (Full Controlled Spec)

This document defines exact slide content and layout.
The model must NOT reinterpret, beautify, or redesign.

Global hard constraints:
- White background only (#FFFFFF)
- No background grid
- No texture
- No gradients
- No shadows
- No rounded containers
- No presentation card frames
- No decorative abstract shapes
- Flat, precise, minimal
- If something is not specified, do not invent it

Typography:
- Clean sans-serif (Japanese fully supported)
- Clear hierarchy only through size and weight
- No stylized typography
- No visual drama

---

# Slide 1 — Hero (Brand Impact Version)

White background only.

Layout: strict vertical centered hierarchy.

1. Top center:
   logo.png
   - Width: 12%
   - Monochrome
   - No background plate
   - Clear spacing below

2. Product name (large, bold, centered):

   JUDGMENT

3. Thick horizontal line (stronger than before)
   - Centered
   - 50% width
   - 2px navy

4. Main impact headline (very large, bold, centered):

   AI Agent を
   安全に、説明可能な形で
   業務に導入する。

   (First line slightly larger than others)

5. Subtext (smaller, centered):

   そのための基盤が Judgment です。

6. Bottom center small tag (stronger contrast than before):

   「判断を切り出す」

Spacing:
- Generous vertical spacing.
- Clear separation between brand and message.
- Headline must dominate visually.

---

# Slide 2 — Execution Log (No Judgment Layer)

Purpose:
Everything appears normal.

Top-left small heading:

実行ログ（判断レイヤなし）

Below: full-width raw log table.

Columns:
timestamp | agent | action | result

Rows:

2024-05-20 10:00:01 | support_agent_01 | query_database | success
2024-05-20 10:01:05 | support_agent_01 | summarize_text | success
2024-05-20 10:02:12 | admin_agent_root | update_policy | success
2024-05-20 10:02:45 | support_agent_02 | send_email | success

Rules:
- All text same color (navy/black)
- No highlighted rows
- No colored cells
- No iconography
- Looks like internal admin console
- No rounded container
- No frame

---

# Slide 3 — read_resident_record Detail

Top-left small heading:

read_resident_record / Detail

Plain technical field layout:

timestamp: 2024-05-20 10:05:00
action: read_resident_record
target_id: user_882910
result: success
reason: —
role_context: —
justification: —

Bottom-right small subtle message:

理由は記録されていない

Rules:
- No decorative elements
- No highlight
- No icon
- No visual emphasis
- Absence must feel neutral

---

# Slide 4 — Mixed Agents Log

Top-left small heading:

実行ログ（役割混在）

Same table style as Slide 2.

Rows:

2024-05-20 11:15:00 | assistant_agent | read_resident_record | success
2024-05-20 11:15:02 | admin_agent | delete_record | success
2024-05-20 11:15:05 | assistant_agent | export_data | success
2024-05-20 11:16:10 | mixed_agent_b4 | access_financials | success

Bottom center small message:

役割の違いは分からない

Rules:
- No illustration
- No graphics
- No decoration
- No background change
- Must look identical to Slide 2 except content

---

# Strict Prohibitions (All Slides)

- Do not add corner logo
- Do not add grid background
- Do not add vertical decorative lines
- Do not add UI card container
- Do not reinterpret layout
- Do not create infographic style
- Do not change wording
