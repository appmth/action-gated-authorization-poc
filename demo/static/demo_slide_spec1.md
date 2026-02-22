# Judgment Demo Slide Generation Spec

## Overall Design Direction

Tone:
- Professional
- Quiet
- Minimal
- Neutral

Visual Identity:
- Background: Pure White (#FFFFFF)
- Text: Navy Blue (#0A2540)
- Accent: Royal Blue (#0052CC) or Intelligent Blue (#00B8D9)
- Flat vector style
- Sharp geometric shapes
- No shadows, no gradients

Typography:
- Modern sans-serif (Inter / Helvetica)
- Generous letter spacing in headings
- Minimal text
- Numbers in geometric or monospaced style

No decorative elements.
No marketing tone.
No dramatic visuals.

---

# Slide 1: Title Slide

## Purpose
Introduce the concept without emotional emphasis.

## Title Text (Japanese)

AI Agent を、
安全に、説明可能な形で
業務に導入する。

そのための基盤が、
Judgment です。

## Visual Direction

- Large centered typography
- Wide line spacing
- No icons
- Very minimal layout
- Possibly subtle geometric horizontal divider line

No additional explanation text.

---

# Slide 2: Execution Result (No Judgment Layer)

## Purpose
Show a system where everything looks "successful" but lacks judgment context.

## Visual Direction

Mock system log screen:

- White background
- Clean tabular layout
- Columns:
  - timestamp
  - agent
  - action
  - result

All rows:
result = success

Example rows:

2026-02-01 09:01 | assistant_agent | send_notification | success
2026-02-01 09:03 | assistant_agent | read_resident_record | success
2026-02-01 09:05 | admin_agent | update_benefit_status | success

No highlight.
No red.
No warning.

It must look normal and harmless.

---

# Slide 3: read_resident_record Detail

## Purpose
Show that only "read" is recorded.

## Visual Direction

System log detail view.

- action: read_resident_record
- target: resident_id: 10294
- result: success

Missing fields:
- reason
- role context
- justification

Layout should subtly emphasize absence through empty fields.

No dramatic styling.

---

# Slide 4: Mixed Agents Log

## Purpose
Show role indistinguishability.

## Visual Direction

Log list mixing:

assistant_agent
admin_agent

No role explanation.
Same visual weight.

Everything marked success.

Layout identical to Slide 2 but mixed agents.
