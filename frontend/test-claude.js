const { cleanSalonListWithClaudeStdin } = require('./src/lib/claudeProcessor');

const testData = `A.H Salon Newtown
Dolce Vita Beaute
Betterday Hair&Beauty
Body Stimulants Beauty and Massage Centre
Bella (incomplete listing)
KC Beautee
Hair Salons (16):
WINK BAR LASH STUDIO & LASH SUPPLIES
Beauty Salons (7):
Glow Girl
Simply Stunning
Lady Lash | Sydney Eyelash Extension Specialists
Contour Clinics Newtown
A-H SHOP | SALON
This gives me a total of 62 businesses
Les Deux Garcons Barber
Innovate Hair (also listed as Hair Innovation)
Groove Salon
Care Nails Japanese Nail Salon
Supretty美学馆
Kim Sun Young
More den Nails
Make Nails Beauty
Catchy Nails & Beauty Salon
TT PRONAILS
Newtown Nails & Spa (same as Newtown Nail Spa)
Newtown Nail Spa
After removing duplicates
Tip Top Nails
Ocean Nails & Beauty`;

async function test() {
  try {
    console.log('Testing Claude cleanup with sample data...');
    const cleaned = await cleanSalonListWithClaudeStdin(testData);
    console.log('\nCleaned salons:');
    cleaned.forEach((salon, i) => {
      console.log(`${i + 1}. ${salon}`);
    });
    console.log(`\nTotal: ${cleaned.length} unique salons`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();