from hypothesis.internal.conjecture.choice import choice_permitted
from hypothesis.internal.conjecture.providers import AVAILABLE_PROVIDERS, GLOBAL_CONSTANTS, HypothesisProvider

BACKEND = "necromancer_fixed_constants"


class FixedConstantsProvider(HypothesisProvider):
    def _maybe_draw_constant(self, choice_type, constraints, *, p=0.05):
        if self._random.random() > p:
            return None
        pool = [c for c in GLOBAL_CONSTANTS.set_for_type(choice_type) if choice_permitted(c, constraints)]
        if not pool:
            return None
        return self._random.choice(pool)


AVAILABLE_PROVIDERS[BACKEND] = FixedConstantsProvider
