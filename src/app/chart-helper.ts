
export interface HostRow {
  platform: string;
  subplatform: string;
  hostname: string;
}

export interface TestResult {
  result: number;
  hostIndex: number;
}

export interface VersionColumn {
  version: string;
  testResults: TestResult[];
}

export interface ChartScene {
  hostRows: HostRow[];
  versionColumns: VersionColumn[];
}

// Platform and subplatform definitions
export const PLATFORMS = {
  SHARK: 'shark',
  DOLPHIN: 'dolphin',
  OCTOPUS: 'octopus',
  BUTTERFLY: 'butterfly',
  BEE: 'bee',
  CRAB: 'crab',
  JELLYFISH: 'jellyfish',
  SEAL: 'seal'
} as const;

export const SUBPLATFORMS = {
  // Platforms with subplatforms
  [PLATFORMS.SHARK]: {
    HAMMERHEAD: 'hammerhead',
    GREAT_WHITE: 'great-white'
  },
  [PLATFORMS.DOLPHIN]: {
    BOTTLENOSE: 'bottlenose',
    SPINNER: 'spinner'
  },
  [PLATFORMS.OCTOPUS]: {
    COMMON: 'common',
    BLUE_RINGED: 'blue-ringed'
  }
} as const;

export type PlatformType = typeof PLATFORMS[keyof typeof PLATFORMS];
export type SubplatformType = typeof SUBPLATFORMS[keyof typeof SUBPLATFORMS][keyof typeof SUBPLATFORMS[keyof typeof SUBPLATFORMS]];

// Helper function to get available subplatforms for a platform
export function getSubplatformsForPlatform(platform: PlatformType): string[] {
  const subplatforms = SUBPLATFORMS[platform as keyof typeof SUBPLATFORMS];
  return subplatforms ? Object.values(subplatforms) : [];
}

// Helper function to check if a platform has subplatforms
export function hasSubplatforms(platform: PlatformType): boolean {
  return platform in SUBPLATFORMS;
}

// Common North American first names for hostnames
const COMMON_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
  'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kenneth', 'Laura', 'Kevin', 'Emily', 'Brian', 'Kimberly', 'George', 'Deborah',
  'Edward', 'Dorothy', 'Ronald', 'Lisa', 'Timothy', 'Nancy', 'Jason', 'Karen',
  'Jeffrey', 'Betty', 'Ryan', 'Helen', 'Jacob', 'Sandra', 'Gary', 'Donna',
  'Nicholas', 'Carol', 'Eric', 'Ruth', 'Jonathan', 'Sharon', 'Stephen', 'Michelle',
  'Larry', 'Laura', 'Justin', 'Emily', 'Scott', 'Kimberly', 'Brandon', 'Deborah',
  'Benjamin', 'Dorothy', 'Frank', 'Lisa', 'Gregory', 'Nancy', 'Raymond', 'Karen',
  'Samuel', 'Betty', 'Patrick', 'Helen', 'Alexander', 'Sandra', 'Jack', 'Donna',
  'Dennis', 'Carol', 'Jerry', 'Ruth', 'Tyler', 'Sharon', 'Aaron', 'Michelle',
  'Jose', 'Laura', 'Adam', 'Emily', 'Nathan', 'Kimberly', 'Henry', 'Deborah',
  'Douglas', 'Dorothy', 'Zachary', 'Lisa', 'Peter', 'Nancy', 'Kyle', 'Karen',
  'Walter', 'Betty', 'Ethan', 'Helen', 'Jeremy', 'Sandra', 'Harold', 'Donna',
  'Carl', 'Carol', 'Keith', 'Ruth', 'Roger', 'Sharon', 'Gerald', 'Michelle',
  'Christian', 'Laura', 'Terry', 'Emily', 'Sean', 'Kimberly', 'Gavin', 'Deborah',
  'Austin', 'Dorothy', 'Arthur', 'Lisa', 'Noah', 'Nancy', 'Lawrence', 'Karen',
  'Jesse', 'Betty', 'Joe', 'Helen', 'Bryan', 'Sandra', 'Billy', 'Donna',
  'Jordan', 'Carol', 'Albert', 'Ruth', 'Dylan', 'Sharon', 'Bruce', 'Michelle',
  'Willie', 'Laura', 'Gabriel', 'Emily', 'Alan', 'Kimberly', 'Juan', 'Deborah',
  'Logan', 'Dorothy', 'Wayne', 'Lisa', 'Roy', 'Nancy', 'Ralph', 'Karen',
  'Randy', 'Betty', 'Eugene', 'Helen', 'Vincent', 'Sandra', 'Russell', 'Donna',
  'Elijah', 'Carol', 'Louis', 'Ruth', 'Bobby', 'Sharon', 'Philip', 'Michelle',
  'Johnny', 'Laura', 'Johnny', 'Emily'
];

// Helper function to get a random name
function getRandomName(): string {
  return COMMON_NAMES[Math.floor(Math.random() * COMMON_NAMES.length)];
}

// Helper function to create a sample ChartScene with 20 hostRows
export function createSampleChartScene(): ChartScene {
  const hostRows: HostRow[] = [];
  const usedNames = new Set<string>();
  
  // First, ensure we have at least one of each platform and subplatform
  const requiredRows: HostRow[] = [];
  
  // Add one of each platform with subplatforms
  Object.entries(SUBPLATFORMS).forEach(([platform, subplatforms]) => {
    Object.values(subplatforms).forEach(subplatform => {
      let hostname: string;
      do {
        hostname = getRandomName();
      } while (usedNames.has(hostname));
      usedNames.add(hostname);
      
      requiredRows.push({
        platform,
        subplatform,
        hostname
      });
    });
  });
  
  // Add one of each platform without subplatforms
  const platformsWithoutSubplatforms = Object.values(PLATFORMS).filter(
    platform => !hasSubplatforms(platform)
  );
  
  platformsWithoutSubplatforms.forEach(platform => {
    let hostname: string;
    do {
      hostname = getRandomName();
    } while (usedNames.has(hostname));
    usedNames.add(hostname);
    
    requiredRows.push({
      platform,
      subplatform: '',
      hostname
    });
  });
  
  // Add the required rows first
  hostRows.push(...requiredRows);
  
  // Fill the remaining slots (20 total) with random platforms
  const remainingSlots = 20 - hostRows.length;
  
  for (let i = 0; i < remainingSlots; i++) {
    const randomPlatform = Object.values(PLATFORMS)[Math.floor(Math.random() * Object.values(PLATFORMS).length)];
    
    let hostname: string;
    do {
      hostname = getRandomName();
    } while (usedNames.has(hostname));
    usedNames.add(hostname);
    
    if (hasSubplatforms(randomPlatform)) {
      // For platforms with subplatforms, randomly choose one
      const subplatforms = getSubplatformsForPlatform(randomPlatform);
      const randomSubplatform = subplatforms[Math.floor(Math.random() * subplatforms.length)];
      
      hostRows.push({
        platform: randomPlatform,
        subplatform: randomSubplatform,
        hostname
      });
    } else {
      // For platforms without subplatforms
      hostRows.push({
        platform: randomPlatform,
        subplatform: '',
        hostname
      });
    }
  }
  
  // Create sample version columns
  const versionColumns: VersionColumn[] = createVersionColumns(hostRows);
  
  return {
    hostRows,
    versionColumns
  };
}

// Helper function to create version columns with test results
export function createVersionColumns(hostRows: HostRow[]): VersionColumn[] {
  const versionColumns: VersionColumn[] = [];
  
  // Create 100 versions from v1.0.1 to v1.0.100
  for (let versionNum = 1; versionNum <= 100; versionNum++) {
    const version = `v1.0.${versionNum}`;
    const testResults: TestResult[] = [];
    
    // Determine how many total test results this version should have (5-30)
    const totalTestResults = Math.floor(Math.random() * 26) + 5; // 5 to 30
    
    // Create a map to track how many test results each host has
    const hostTestCounts = new Map<number, number>();
    
    // Initialize all hosts with 0 test results
    for (let i = 0; i < hostRows.length; i++) {
      hostTestCounts.set(i, 0);
    }
    
    // Generate test results
    for (let i = 0; i < totalTestResults; i++) {
      // Find hosts that have less than 3 test results
      const availableHosts = Array.from(hostTestCounts.entries())
        .filter(([_, count]) => count < 3)
        .map(([hostIndex, _]) => hostIndex);
      
      if (availableHosts.length === 0) {
        break; // No more hosts can accept test results
      }
      
      // Randomly select a host
      const randomHostIndex = availableHosts[Math.floor(Math.random() * availableHosts.length)];
      
      // Create test result with value between 1 and 5
      const testResult: TestResult = {
        result: Math.floor(Math.random() * 5) + 1, // 1 to 5
        hostIndex: randomHostIndex
      };
      
      testResults.push(testResult);
      
      // Update the count for this host
      hostTestCounts.set(randomHostIndex, hostTestCounts.get(randomHostIndex)! + 1);
    }
    
    versionColumns.push({
      version,
      testResults
    });
  }
  
  return versionColumns;
}