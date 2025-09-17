const cron = require('node-cron');
const silverPriceService = require('../services/silver-price.service');

// Schedule a job to update silver price every day at 6:00 AM server time
cron.schedule('0 6 * * *', async () => {
  try {
    console.log('[CRON] Fetching and updating silver price...');
    const priceData = await silverPriceService.fetchCurrentSilverPrice();
    await silverPriceService.saveSilverPrice(priceData);
    console.log('[CRON] Silver price updated successfully.');
  } catch (error) {
    console.error('[CRON] Error updating silver price:', error.message);
  }
});

// Export nothing, just require this file in index.js to activate
