export interface SampleClaim {
  id: string;
  title: string;
  record: string;
  output: string;
}

export const SAMPLE_CLAIMS: SampleClaim[] = [
  {
    id: "CLM000101",
    title: "Typical claimant, two dependents",
    record: "CLM0001010008200000009100000008800000009400000241N00000000000000N               ",
    output: "0000361000005000000000000411000000101000",
  },
  {
    id: "CLM000102",
    title: "High earner, base capped",
    record: "CLM0001020021000000024000000022500000023000000137N00000000000000N               ",
    output: "0000650000002500000000000675000000111000",
  },
  {
    id: "CLM000103",
    title: "Low wages, ineligible",
    record: "CLM0001030000600000000500000000700000000400000025N00000000000000N               ",
    output: "0100000000000000000000000000000010000000",
  },
  {
    id: "CLM000104",
    title: "Single quarter of work",
    record: "CLM0001040000000000000000000000000000007200000030N00000000000000N               ",
    output: "0200000000000000000000000000000001000000",
  },
  {
    id: "CLM000105",
    title: "Offset larger than benefit",
    record: "CLM0001050006000000006500000006200000006100000058V00120000030000N               ",
    output: "0000250000000000002700000000000000100010",
  },
  {
    id: "CLM000106",
    title: "Retiree exemption at 62",
    record: "CLM0001060007000000007100000006900000007300000062M00180000000000N               ",
    output: "0000280000000000000000000280000000100001",
  },
  {
    id: "CLM000107",
    title: "Boundary quarter shift",
    record: "CLM0001070005000000005200000005100000009000000345N00000000000000Y               ",
    output: "0000200000007500000000000191250100101100",
  },
  {
    id: "CLM000108",
    title: "Malformed wages, rejected",
    record: "CLM00010800000ABC0000000000000000000000000000000N0000000000000N                 ",
    output: "9900000000000000000000000000001000000000",
  },
];
