# Security

Please use this repository's GitHub **Security → Report a vulnerability** feature for confidential reports. Do not post credentials, phone numbers, message bodies, customer details, or exploit material in public issues.

This is a portfolio source snapshot. Configure your own isolated provider accounts before running integration features. Credentials, account IDs, contact lists, deployment records, and operational data are intentionally excluded. Do not copy private Git history or operational artifacts into this repository.

A successful local test does not establish live SMS delivery, customer-specific compliance, or production acceptance.

## Dependency review — October 15, 2026

The public snapshot's compatible security updates pass `npm audit --omit=dev` with zero reported runtime vulnerabilities. Five high-severity advisories remain in the ESLint configuration's glob-matching dependency chain. npm currently proposes downgrading the Next.js lint configuration to version 14 to remove that chain; this snapshot retains a compatible Next.js 16 toolchain. Review `npm audit` before running development tools on untrusted input. This review applies to this source snapshot and is not a production security certification.
