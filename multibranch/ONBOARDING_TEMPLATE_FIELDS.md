# Branch Onboarding Template Fields

Each new branch should provide one Excel workbook with the following sheets.

## 1. Branch
Required columns:
- Branch Code
- Branch Name
- School Name
- Location
- Academic Year
- Dean / Branch Super Admin Name
- Dean Employee ID / Code (if available)
- Dean Mobile Number / Login Username
- Dean Email (optional)

## 2. Classes_Sections
Required columns:
- Class Display Name (example: 6A)
- Internal Batch Code (example: C5A)
- Grade (example: 6)
- Orientation / Programme (C Batch / Lead / Techno)
- Floor (optional)
- Active (Yes/No)

## 3. Teachers
Required columns:
- Teacher Full Name
- Employee ID / Code (if available)
- Designation
- Department
- Primary Subject
- Mobile Number / Login Username
- Email (optional)
- Active (Yes/No)

## 4. Teaching_Mappings
One row per class-subject-teacher allocation.
Required columns:
- Class Display Name
- Internal Batch Code
- Subject
- Department
- Teacher Full Name
- Periods Per Week
- Week Pattern (Every Week / Week A / Week B if applicable)
- Class Teacher (Yes/No)
- Co-Class Teacher (Yes/No)
- Active for Syllabus Tracking (Yes/No)

## 5. HODs
Required columns:
- HOD Name
- Department
- Employee ID / Code (if available)
- Mobile Number / Login Username

## 6. Subjects
Required columns:
- Subject Name
- Department
- Active for Syllabus Tracking (Yes/No)

Notes:
- Year Plan files are uploaded after onboarding and mapped to branch + class/section + subject.
- Weekly Status is not imported during onboarding.
- Every imported row must receive the new branch_id before it becomes visible in the application.
- Duplicate teacher names should be resolved using Employee ID / Code wherever available.
- No new branch is allowed to reuse another branch's data rows.