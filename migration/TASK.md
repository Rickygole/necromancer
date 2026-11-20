# Migration task

Translate one paragraph of a real COBOL batch program to Python. The source is AWS CardDemo, program CBACT04C, paragraph 1300-COMPUTE-INTEREST (Apache-2.0).

## The COBOL

```cobol
       1300-COMPUTE-INTEREST.
           COMPUTE WS-MONTHLY-INT
            = ( TRAN-CAT-BAL * DIS-INT-RATE) / 1200

           ADD WS-MONTHLY-INT  TO WS-TOTAL-INT
           PERFORM 1300-B-WRITE-TX.
```

Field declarations:

```cobol
       01  TRAN-CAT-BAL                PIC S9(09)V99.
       01  DIS-INT-RATE                PIC S9(04)V99.
       01  WS-MONTHLY-INT              PIC S9(09)V99.
       01  WS-TOTAL-INT                PIC S9(09)V99.
```

`DIS-INT-RATE` is an annual percentage rate. `1300-B-WRITE-TX` writes a transaction record and is out of scope.

## The contract

Create `migration/interest.py` with one function:

```python
def compute_interest(balance, annual_rate_percent, total_interest):
    return monthly_interest, new_total_interest
```

- All four values are `decimal.Decimal`. No floats.
- `monthly_interest` is the new value of `WS-MONTHLY-INT`. `new_total_interest` is the new value of `WS-TOTAL-INT` after the `ADD`.
- Decide yourself what the Python function does for every input, including inputs that do not fit the declared fields. Write the decision in a docstring-free way: put it in the spec design, not in code comments.

## Rules

- Work from this file and the COBOL above only. Do not open `case_studies/`, `oracle/`, `modern/`, `evidence/` or `tests/`.
- Use the spec workflow: requirements, design, tasks, then implement.
- Say in the chat which files you read.
