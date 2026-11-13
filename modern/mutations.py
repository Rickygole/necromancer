MUTATIONS = {
    "M1": {
        "label": "round base",
        "description": "Round the base weekly benefit half up instead of truncating it.",
    },
    "M2": {
        "label": "cap off by one",
        "description": "Base benefit cap is 651.00 instead of 650.00.",
    },
    "M3": {
        "label": "exemption above 62",
        "description": "Retirement exemption starts above age 62 instead of at 62.",
    },
    "M4": {
        "label": "clamp net",
        "description": "Explicitly clamp a negative net payout to zero.",
    },
    "M5": {
        "label": "early truncation",
        "description": "Truncate total wages / 52 to cents before applying 65 percent.",
    },
}

HIDDEN_MUTANTS = {
    "H1": {
        "label": "count ignores shift",
        "description": "Quarter counting uses the original Q4 even when the flag is Y.",
    },
    "H2": {
        "label": "dependents above 12",
        "description": "Dependents above 12 are treated as 3.",
    },
    "H3": {
        "label": "age modulo 18",
        "description": "Age is read modulo 18 for the retirement exemption test.",
    },
}


def is_active(selected, mutation_id):
    return selected == mutation_id
