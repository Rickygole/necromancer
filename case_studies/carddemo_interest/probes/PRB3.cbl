       IDENTIFICATION DIVISION.
       PROGRAM-ID. PRB3.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  BAL        PIC S9(09)V99.
       01  RATE       PIC S9(04)V99.
       01  PLAIN      PIC S9(09)V99.
       01  ALONE      PIC S9(09)V99 SIGN LEADING SEPARATE.
       01  OUT-REC.
           05  OUT-P  PIC S9(09)V99 SIGN LEADING SEPARATE.
           05  OUT-Q  PIC S9(09)V99 SIGN LEADING SEPARATE.
       PROCEDURE DIVISION.
           MOVE -600000000.00 TO BAL
           MOVE 2000.00 TO RATE
           COMPUTE PLAIN = (BAL * RATE) / 1200
           MOVE PLAIN TO ALONE
           MOVE PLAIN TO OUT-P
           DISPLAY "minus 1000000000.00 moved to a lone field: " ALONE
           DISPLAY "same value moved into a group member: " OUT-REC
           DISPLAY "same value shown directly: " PLAIN
           MOVE 600000000.00 TO BAL
           COMPUTE PLAIN = (BAL * RATE) / 1200
           MOVE PLAIN TO OUT-P
           DISPLAY "plus 1000000000.00 moved into a group member: "
               OUT-REC
           STOP RUN.
