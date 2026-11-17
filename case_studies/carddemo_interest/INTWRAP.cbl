       IDENTIFICATION DIVISION.
       PROGRAM-ID. INTWRAP.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO KEYBOARD
               ORGANIZATION IS LINE SEQUENTIAL.
           SELECT OUT-FILE ASSIGN TO DISPLAY
               ORGANIZATION IS LINE SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE
           RECORD IS VARYING IN SIZE FROM 1 TO 512
               DEPENDING ON WS-IN-LEN.
       01  IN-LINE                     PIC X(512).
       FD  OUT-FILE.
       01  OUT-LINE                    PIC X(40).
       WORKING-STORAGE SECTION.
       01  WS-IN-LEN                   PIC 9(4) COMP.
       01  WS-EOF                      PIC X VALUE 'N'.
           COPY CVTRA01Y.
           COPY CVTRA02Y.
           COPY MISCVARS.
       01  IN-REC.
           05  IN-TOT-SIGN             PIC X.
           05  IN-TOT-X                PIC X(11).
           05  IN-TOT REDEFINES IN-TOT-X PIC 9(9)V99.
           05  IN-BAL-SIGN             PIC X.
           05  IN-BAL-X                PIC X(11).
           05  IN-BAL REDEFINES IN-BAL-X PIC 9(9)V99.
           05  IN-RATE-SIGN            PIC X.
           05  IN-RATE-X               PIC X(6).
           05  IN-RATE REDEFINES IN-RATE-X PIC 9(4)V99.
       01  OUT-REC.
           05  OUT-MONTHLY             PIC S9(09)V99
                                       SIGN LEADING SEPARATE.
           05  OUT-TOTAL               PIC S9(09)V99
                                       SIGN LEADING SEPARATE.
           05  FILLER                  PIC X(16) VALUE ALL ".".
       PROCEDURE DIVISION.
       0000-MAIN.
           OPEN INPUT IN-FILE
           OPEN OUTPUT OUT-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ IN-FILE
                   AT END
                       MOVE 'Y' TO WS-EOF
                   NOT AT END
                       PERFORM 0100-RUN-ONE
               END-READ
           END-PERFORM
           CLOSE IN-FILE
           CLOSE OUT-FILE
           STOP RUN.
       0100-RUN-ONE.
           MOVE IN-LINE(1:31) TO IN-REC
           MOVE IN-TOT TO WS-TOTAL-INT
           IF IN-TOT-SIGN = '-'
               COMPUTE WS-TOTAL-INT = 0 - WS-TOTAL-INT
           END-IF
           MOVE IN-BAL TO TRAN-CAT-BAL
           IF IN-BAL-SIGN = '-'
               COMPUTE TRAN-CAT-BAL = 0 - TRAN-CAT-BAL
           END-IF
           MOVE IN-RATE TO DIS-INT-RATE
           IF IN-RATE-SIGN = '-'
               COMPUTE DIS-INT-RATE = 0 - DIS-INT-RATE
           END-IF
           MOVE 0 TO WS-MONTHLY-INT
           PERFORM 1300-COMPUTE-INTEREST.
           COPY PARA1300.
       1300-B-WRITE-TX.
           MOVE WS-MONTHLY-INT TO OUT-MONTHLY
           MOVE WS-TOTAL-INT TO OUT-TOTAL
           WRITE OUT-LINE FROM OUT-REC.
