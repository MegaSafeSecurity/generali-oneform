# PDF Field Mapping Register

## Source page dimensions
All three blank source templates are A4 portrait, approximately 595.28 × 841.89 PDF points. No interactive AcroForm fields were detected by pypdf; they are flattened PDFs. Coordinates below therefore require manual visual mapping.

## Status

| Form | Source PDF | Pages | Field inventory | Exact coordinate map | Sign/stamp map | Final PDF QA |
|---|---|---:|---|---|---|---|
| PI | PI-Security Guards PF (EN) 022025.pdf | 6 | Initial inventory in SOURCE-FORM-INVENTORY.md | NOT DONE | Signature page 4; stamp instruction on page 1 but no clearly labelled dedicated stamp box | NOT DONE |
| PL | Public Liability Insurance PF (EN) 022025.pdf | 5 | Initial inventory in SOURCE-FORM-INVENTORY.md | NOT DONE | Proposer signature/company stamp/designation page 3; agent verification separate on page 3 | NOT DONE |
| Biz PA / GPA workflow | Biz PA Proposal Form (EM) 122025.pdf | 7 | Initial inventory in SOURCE-FORM-INVENTORY.md | NOT DONE | Employer/authorized officer, witness and company stamp page 3; insured persons/premium table page 7 | NOT DONE |

## Coordinate-map schema to implement
Use a separate JSON map per template version. All coordinates are PDF points with origin at bottom-left. For a UI/PDF.js overlay using top-left origin, transform `pdfY = pageHeight - topY - fieldHeight`.

```json
{
  "templateId": "PI-SECURITY-GUARDS-02-2025",
  "pageSize": { "width": 595.28, "height": 841.89 },
  "pages": {
    "1": [
      { "key": "firm", "type": "text", "x": 0, "y": 0, "width": 0, "height": 0, "fontSize": 9, "verified": false }
    ]
  }
}
```

Zero coordinates above are intentionally placeholders, not usable field positions. Do not enable final PDF generation until every field has a measured coordinate and `verified: true` after visual QA.

## Mandatory QA cases
- Short, typical and maximum-length text.
- Multi-line addresses and narrative disclosures.
- Yes/No radio and checkbox alignment.
- Dates and numeric currency values.
- Signature image and stamp image scaling, preserving aspect ratio.
- GPA member table with one, several and overflow members; continuation sheet behavior must be confirmed against Generali's instruction.
- Print at 100% on A4; compare with original page boundaries and ensure no original wording/lines are obscured.
