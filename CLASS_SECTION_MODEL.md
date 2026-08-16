# Permanent Class / Section / Orientation Model

Effective 16 Aug 2026.

## Visible model

The Syllabus Tracker must present a class using three separate concepts:

1. **Grade / Class** — e.g. `6th`, `7th`, `8th`, `9th`, `10th`.
2. **Section Code** — e.g. `C5A`, `C5B`, `L5A`, `C4A`, `L4A`.
3. **Orientation / Programme** — branch-defined, e.g. Khalsa uses `C Batch`, `Lead`, `Techno`.

Do not use legacy visible identifiers such as `6A`, `6B`, `7A`, `8A` as the class/section name.

## Khalsa

Khalsa keeps its existing database record IDs and mappings, but legacy `6A/6B/...` keys are hidden from user-facing screens. Current Lead section codes are normalized as:
- Grade 6th — `L5A`
- Grade 7th — `L4A`
- Grade 8th — `L3A`
- Grade 9th — `L2A`

Khalsa orientations remain `C Batch`, `Lead`, and `Techno`.

## Other branches

Other branches are not required to use Khalsa orientation names. Their onboarding workbook asks for:
- `Grade / Class`
- `Section Code`
- `Orientation / Programme`

The system generates any hidden internal class key automatically. The receiving branch must not create a separate display name such as `6A` or `6B`.

## Display examples

- `6th · C5A · C Batch`
- `6th · C5B · C Batch`
- `6th · L5A · Lead`

If Section Code and Orientation are effectively the same label (for example a legacy Techno section), the UI avoids repeating the same word twice.

## Compatibility

Existing Khalsa teaching mappings, Year Plan links, Weekly Status history and record IDs are preserved. Only the visible class model and section-code metadata are normalized.