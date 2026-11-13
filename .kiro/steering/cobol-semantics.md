---
inclusion: always
---
- A compound COMPUTE keeps full intermediate precision and truncates only at the final store.
- Overflow and sign behavior come from probes in evidence/probes, never from assumption.
- Every arithmetic result is a Decimal quantized once, at the store.
- A store without ROUNDED truncates toward zero. Confirm on the oracle before relying on it.
