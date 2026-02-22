# Judgment Demo Slides (Controlled Generation)

This document defines exact slide content.
The model must not reinterpret or beautify.

Hard constraints:
- White background only (#FFFFFF)
- No background grid
- No decorative lines
- No shadows
- No gradients
- No rounded card containers
- No presentation-style framing
- No abstract decorative shapes
- Flat, technical, minimal
- If something is not specified, do not invent it

---

# Slide 1

Elements:
- logo.png (top-left, small, 5% width, no background plate)
- Minimal AI Agent line illustration (top-right, 6% width)
  - Monochrome navy
  - Single line vector
  - Geometric silhouette
  - No face
  - No expression
  - No 3D
  - No color fill

Centered main text block:

AI Agent を、
安全に、説明可能な形で
業務に導入する。

そのための基盤が、
Judgment です。

Optional small footer text (center-bottom):
認可を切り出す

No other content.

---

# Slide 2

Top-left small heading:
実行ログ（判断レイヤなし）

Full-width raw system log table.

Columns:
timestamp | agent | action | result

Rows:

2024-05-20 10:00:01 | support_agent_01 | query_database | success
2024-05-20 10:01:05 | support_agent_01 | summarize_text | success
2024-05-20 10:02:12 | admin_agent_root | update_policy | success
2024-05-20 10:02:45 | support_agent_02 | send_email | success

No highlight.
No colored cells.
No warning.
All text same color (navy/black).

---

# Slide 3

Title (top-left small):
read_resident_record / Detail

Fields layout (plain technical view):

timestamp: 2024-05-20 10:05:00
action: read_resident_record
target_id: user_882910
result: success
reason: —
role_context: —
justification: —

Small bottom-right message:
理由は記録されていない

No design emphasis.
No icons.
No decoration.

---

# Slide 4

Top-left small heading:
実行ログ（役割混在）

Full-width log table (same style as Slide 2).

Rows:

2024-05-20 11:15:00 | assistant_agent | read_resident_record | success
2024-05-20 11:15:02 | admin_agent | delete_record | success
2024-05-20 11:15:05 | assistant_agent | export_data | success
2024-05-20 11:16:10 | mixed_agent_b4 | access_financials | success

Small bottom center message:
役割の違いは分からない

No illustration.
No graphics.
No extra elements.
