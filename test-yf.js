const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function run() {
  const q = await yf.quoteSummary('BBCA.JK', { modules: ['summaryDetail', 'price', 'financialData'] });
  console.log(JSON.stringify(q, null, 2));
}

run();
