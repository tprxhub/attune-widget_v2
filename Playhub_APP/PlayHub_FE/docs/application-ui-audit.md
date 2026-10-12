# Play Hub application audit

Audited locally on 12 October 2026 using isolated seeded databases.

## Coverage

Checked Super Admin, TTP employee, School Admin, Clinic Admin, School Moderator, Clinic Moderator, organisation Member, subscribed family, free family, family Moderator and public visitor screens at 320, 390, 768 and 1440 CSS pixels. The browser audit covered 384 route/viewport combinations, including Play Dose and activity detail pages. Public coverage includes landing, authentication, invitation, Play Pulse and policy pages.

Checked dialog and dropdown placement for child profile/subscription/invitations, plan/dose editors, staff and organisation creation, account settings, session corrections, Moderator assignment, progress filters and account scope. Checked API failures, runtime exceptions, horizontal overflow and invalid displayed values. Follow-up checks retest each detected issue after its fix.

## Changes

- Child identity blocks use the existing progress status icons throughout the application; adult profile pictures remain available.
- Phone navigation provides every allowed destination through More, with keyboard focus management and safe-area spacing. Headers, selectors, chart controls and account preferences fit narrow screens.
- Long forms scroll within the viewport. Select menus and status/support-score explanations render above surrounding cards and remain inside the screen.
- Pending Moderator cards and long plan names no longer expand phone layouts.
- Skill-area totals resolve each child's current dose to its actual Play Plan. Platform team totals count distinct assigned children.
- Child dashboards and platform subscription figures wait for their source data before displaying counts or access tiers.
- TTP child/progress screens use a permission-checked reference endpoint for organisation and dose names. They no longer request restricted activity content, invitations or billing data.
- Session/report loading no longer requires the content catalogue. A rejected catalogue request can retry. Failed active queries show a retry action and preserve mounted pages for recovery.
- The existing local database was backed up and migrated to `0021_attempt_edited`, fixing progress/session queries that failed because edit-history columns were missing. The live API returns successfully for every local child.
- Duplicate policy paragraph keys and misleading platform persona labels are corrected.

## Verification

- Backend test suite: 148 passed, including reference endpoint permissions and response field restrictions.
- Frontend unit tests: 37 passed.
- TypeScript check and production build pass.
- ESLint: zero errors; existing React Fast Refresh export warnings remain.
- Manual dialog/dropdown matrix: 68 checks passed. Live frontend smoke checks on port 3000 pass for child management, platform progress, family dashboard, progress and Check-In.
- Browser regression suite: all 63 unique tests passed across the full run and targeted follow-up runs. The initial failures were corrected: a test left an organisation suspended, the multi-persona test needed a larger total timeout, and pending Moderator cards overflowed at 320px. Coverage includes persona permissions, mutations, mobile navigation, API-backed counts, loading recovery and long phone forms.

These checks use Chromium and seeded account states. They do not establish exhaustive coverage of every possible customer dataset, native browser or external payment/social sign-in service.

## Dashboard alignment follow-up

The dashboard follow-up addresses the cramped child identity row shown at 375px. School and Clinic Admin child cards now use a three-column identity grid with a separate status row, consistent View button placement and a smaller icon on phones. Status filters sit below their section heading on phones. Organisation overview figures use two columns with matching row heights. Family, organisation Member and Moderator summary cards keep identity and status in a stable grid. Platform figures reserve the same space for their labels so wrapped labels do not move numeric values.

A dedicated browser regression checks icon/button vertical centres and single-line status labels at 320, 375, 390, 768 and 1440px. Ten persona dashboard previews at 375px load without overflow or failed API requests. The follow-up production build, frontend unit tests and TypeScript check pass.
