/**
 * config/securityRules.js
 * ------------------------
 * Central configuration for all rule-based security thresholds.
 *
 * Edit values here only — do not scatter magic numbers across controllers.
 *
 * TWO DISTINCT DETECTION PATHS
 * ─────────────────────────────
 *  1. ML Detection   (source = 'ml_auto')
 *     POST /api/threats/analyze → 42-feature UNSW-NB15 network-flow data
 *     → NumpyLSTMPredictor → real binary prediction → risk_level
 *     The LSTM was trained on UNSW-NB15 network packet/flow features.
 *     It does NOT understand authentication events.
 *
 *  2. Authentication-Rule Detection  (source = 'authentication_rule')
 *     Monitors failed login counts within a sliding time window.
 *     A rule-based check — NOT the LSTM model.
 *     Labelled honestly so admins know which system detected the event.
 *
 * NEVER conflate these two.  Never label a rule-based event as 'ml_auto'.
 */

module.exports = {

  // ── BRUTE-FORCE / FAILED-LOGIN DETECTION ──────────────────
  //
  // Sliding window: we count login_failed events for a specific
  // userId within the last WINDOW_MS milliseconds.
  //
  // LEVELS:
  //   WARNING  — 5+ failures → Medium risk threat log,  NO restriction
  //   HIGH     — 10+ failures → High risk threat log + 30-min restriction
  //
  BRUTE_FORCE: {
    WINDOW_MS:             5 * 60 * 1000,   // 5 minutes
    WARNING_COUNT:         5,               // ≥ 5 failures → Medium risk threat
    HIGH_COUNT:            10,              // ≥ 10 failures → High risk + restrict
    RESTRICTION_MINUTES:   30,              // temporary restriction duration
    COOLDOWN_MS:           2 * 60 * 1000,  // 2-minute cooldown: don't create duplicate
    //                                        threat records for the same burst
  },

  // ── ML AUTO-RESTRICTION (set in threatController.analyzeActivity) ─
  //
  // When the LSTM returns risk_level === 'High', the user is auto-restricted.
  // These settings mirror what's in threatController — kept here for reference.
  //
  ML_AUTO: {
    RESTRICTION_MINUTES: 30,
  },

};
