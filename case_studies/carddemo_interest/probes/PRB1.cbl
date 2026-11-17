       IDENTIFICATION DIVISION.
       PROGRAM-ID. PRB1.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  BAL        PIC S9(09)V99.
       01  RATE       PIC S9(04)V99.
       01  PLAIN      PIC S9(09)V99.
       01  ROUNDED-V  PIC S9(09)V99.
       01  OUT-P      PIC S9(09)V99 SIGN LEADING SEPARATE.
       01  OUT-R      PIC S9(09)V99 SIGN LEADING SEPARATE.
       PROCEDURE DIVISION.
           MOVE 1000.00 TO BAL
           MOVE 5.00 TO RATE
           PERFORM SHOW
           MOVE -1000.00 TO BAL
           PERFORM SHOW
           MOVE 600.00 TO BAL
           MOVE 0.01 TO RATE
           PERFORM SHOW
           MOVE -600.00 TO BAL
           PERFORM SHOW
           MOVE 600.00 TO BAL
           MOVE 0.02 TO RATE
           PERFORM SHOW
           STOP RUN.
       SHOW.
           COMPUTE PLAIN = (BAL * RATE) / 1200
           COMPUTE ROUNDED-V ROUNDED = (BAL * RATE) / 1200
           MOVE PLAIN TO OUT-P
           MOVE ROUNDED-V TO OUT-R
           DISPLAY BAL " * " RATE " / 1200 : plain " OUT-P
               " rounded " OUT-R.
