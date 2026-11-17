       IDENTIFICATION DIVISION.
       PROGRAM-ID. PRB2.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  BAL        PIC S9(09)V99.
       01  RATE       PIC S9(04)V99.
       01  TOTAL-V    PIC S9(09)V99.
       01  PLAIN      PIC S9(09)V99.
       01  GUARDED    PIC S9(09)V99 VALUE 7.00.
       01  OUT-P      PIC S9(09)V99 SIGN LEADING SEPARATE.
       01  OUT-G      PIC S9(09)V99 SIGN LEADING SEPARATE.
       01  OUT-T      PIC S9(09)V99 SIGN LEADING SEPARATE.
       PROCEDURE DIVISION.
           MOVE 999999999.99 TO BAL
           MOVE 9999.99 TO RATE
           COMPUTE PLAIN = (BAL * RATE) / 1200
           COMPUTE GUARDED = (BAL * RATE) / 1200
               ON SIZE ERROR DISPLAY "size error raised"
           END-COMPUTE
           MOVE PLAIN TO OUT-P
           MOVE GUARDED TO OUT-G
           DISPLAY "compute without clause: " OUT-P
           DISPLAY "compute with ON SIZE ERROR, target left at: " OUT-G
           MOVE 999999999.99 TO TOTAL-V
           MOVE 4.16 TO PLAIN
           ADD PLAIN TO TOTAL-V
           MOVE TOTAL-V TO OUT-T
           DISPLAY "add without clause: " OUT-T
           MOVE 999999999.99 TO TOTAL-V
           ADD PLAIN TO TOTAL-V
               ON SIZE ERROR DISPLAY "add size error raised"
           END-ADD
           MOVE TOTAL-V TO OUT-T
           DISPLAY "add with ON SIZE ERROR, target left at: " OUT-T
           STOP RUN.
