import json
import random
import time
from dataclasses import dataclass, asdict

@dataclass
class TestResult: 
    result: int
    host: int

@dataclass
class Release: 
    timestamp: int
    version: str
    tests: list[TestResult]


def generate_and_save_releases(filename: str = "releases.json"):
    """
    Generates dummy Release data and saves it to a JSON file.

    Args:
        filename: The name of the JSON file to save the data to.
    """
    releases = []
    # Generate 100 releases with version numbers from 1 to 101.
    for i in range(1, 101):
        timestamp = int(time.time()) - (100 - i) * 3600  # Simulate timestamps in the past
        version = f"1.0.{i}"

        tests = []
        # Tests should have a host from 1 to 10 and a result from 1 to 3.
        for _ in range(random.randint(1, 5)):  # Each release can have 1 to 5 tests
            host = random.randint(1, 10) # Generate random integers within a range
            result = random.randint(1, 3)
            tests.append(TestResult(result=result, host=host))

        releases.append(Release(timestamp=timestamp, version=version, tests=tests))

    # Convert the list of dataclass instances to a list of dictionaries.
    releases_data = [asdict(release) for release in releases]

    # Save the data to a JSON file.
    with open(filename, 'w') as f:
        json.dump(releases_data, f, indent=4) 

    print(f"Generated {len(releases)} releases and saved to {filename}")

# Example usage:
if __name__ == "__main__":
    generate_and_save_releases()