"""Read {"groups": [[rewards...], ...], "epsilon": 1e-8} from stdin."""

import json
import sys

from .advantages import normalize_grouped_rewards


def main() -> int:
    try:
        obj = json.load(sys.stdin)
        if not isinstance(obj, dict):
            raise TypeError("JSON input must be an object")
        advantages = normalize_grouped_rewards(obj["groups"], epsilon=obj.get("epsilon", 1e-8))
        json.dump({"advantages": advantages, "std_definition": "population_ddof_0"}, sys.stdout)
        sys.stdout.write("\n")
        return 0
    except (KeyError, ValueError, TypeError, json.JSONDecodeError, OverflowError) as exc:
        print(f"Invalid GRPO input: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
