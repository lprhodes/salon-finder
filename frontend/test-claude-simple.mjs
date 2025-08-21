import { cleanSalonListWithClaudeStdin } from './src/lib/claudeProcessor.js';

const testData = `Hair Salons (16):
A.H Salon Newtown  
Dolce Vita Beaute
Beauty Salons:
KC Beautee
Simply Stunning (also listed under Lash)
This gives me a total of 5 businesses`;

async function test() {
  try {
    console.log('Testing Claude cleanup...');
    const cleaned = await cleanSalonListWithClaudeStdin(testData);
    console.log('\nCleaned salons:', cleaned);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();