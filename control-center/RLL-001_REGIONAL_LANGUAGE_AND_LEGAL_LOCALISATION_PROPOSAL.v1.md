# RLL-001 — Regional Language and Legal Localisation Proposal

## Status

PROPOSED — FUTURE MINI-PROJECT — DO NOT START

## Purpose

Create a governed regional localisation system that presents each user with an appropriate language, currency, legal terms, privacy notice, eligibility rules, and consent flow based on reliable locale and jurisdiction evidence.

## Intended experience

User opens or registers with SKCS → saved preference is checked → browser/device language is checked → country and likely locale are detected → an appropriate language is suggested → the user can change it manually → the correct approved regional legal documents are presented → acceptance evidence is recorded.

## Language selection law

The platform must not decide a person’s exact language solely from IP location. The preference order is:

1. User’s saved language preference
2. Browser or device language
3. Explicit user selection
4. Country or IP detection as a fallback suggestion only

The user must always be able to change the language manually.

## China-specific principle

A user located in China may prefer Simplified Chinese, Traditional Chinese, English, or another supported regional language. Country detection identifies a likely jurisdiction and locale context; it does not prove the user’s language preference.

## Scout’s permitted role

Scout may provide governed context signals such as detected country, language or locale evidence, currency, time zone, jurisdiction candidate, source, timestamp, and confidence.

Scout must not invent law, decide legal obligations, or generate binding legal terms. A separate regional policy registry must select from lawyer-approved documents.

## Required legal controls

- Global base Terms of Service
- Regional legal addenda
- Regional privacy notices
- Age and eligibility requirements
- Permitted payment methods and currencies
- Responsible analytics or gaming disclosures where required
- Document version and effective date
- Immutable acceptance evidence
- Mandatory re-acceptance after material changes
- Fallback behavior when jurisdiction is uncertain
- Translation approval and version parity controls

## Hold conditions

RLL-001 must remain queued until supported launch countries are selected, approved translations exist, legal documents are professionally reviewed, jurisdiction-selection rules are defined, consent evidence storage is approved, and privacy requirements for location detection are satisfied.

## Definition of Done

The platform can safely suggest and display the correct supported language and approved regional legal documents, allow manual override, record exact consent evidence, handle uncertain location without guessing, and prove which document version each user accepted.

## Scope protection

This proposal does not activate geolocation tracking, publish translated legal documents, change registration behavior, infer user identity, or disturb the current active mini-project.
