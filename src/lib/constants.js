/**
 * Shared campaign configuration constants.
 * 
 * Change TOTAL_CAMPAIGN_DAYS or MIN_QUALIFYING_DAYS here and it will propagate to:
 *  - FacilitatorDashboard (attendance grid)
 *  - Dashboard analytics (daily stats & certificate qualification)
 *  - analytics.js (processing)
 *  - SatDashboard, PersonList, FacilitatorDetail, AttendanceSheet
 * 
 * Full campaign certificate threshold is 10 of 12 days.
 * At Day 9, the 3 remaining days (Days 10–12) are granted if a person has attended at least 7 of the 9 days.
 */
export const TOTAL_CAMPAIGN_DAYS = 12;
export const MIN_QUALIFYING_DAYS = 7;
