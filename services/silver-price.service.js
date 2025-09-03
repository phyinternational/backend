const SilverPrice = require("../models/silver-price.model");

class SilverPriceService {
  constructor() {
    // No external API needed - prices will be set manually by admin
  }

  // Fetch current silver price from external API
  async fetchCurrentSilverPrice() {
    try {
      const response = await axios.get(`${this.apiUrl}`, {
        params: {
          api_key: this.apiKey,
          base: 'USD',
          currencies: 'XAG', // Silver symbol
        }
      });

      if (response.data && response.data.rates && response.data.rates.XAG) {
        // Convert from troy ounce to gram (1 troy ounce = 31.1035 grams)
        const pricePerOunce = 1 / response.data.rates.XAG;
        const pricePerGram = pricePerOunce / 31.1035;
        
        // Convert to INR if needed (you might need a separate currency API)
        const priceInINR = pricePerGram * 83; // Approximate USD to INR conversion
        
        return {
          pricePerGram: Math.round(priceInINR * 100) / 100, // Round to 2 decimal places
          currency: 'INR',
          source: 'metalpriceapi'
        };
      }
      
      throw new Error("Invalid API response");
    } catch (error) {
      console.error("Error fetching silver price:", error.message);
      // Return last known price if API fails
      return await this.getLastKnownPrice();
    }
  }

  // Save silver price to database
  async saveSilverPrice(priceData) {
    try {
      // Deactivate previous prices
      await SilverPrice.updateMany(
        { isActive: true },
        { isActive: false }
      );

      // Save new price
      const silverPrice = new SilverPrice({
        ...priceData,
        isActive: true,
        lastUpdated: new Date()
      });

      return await silverPrice.save();
    } catch (error) {
      console.error("Error saving silver price:", error.message);
      throw error;
    }
  }

  // Get current active silver price
  async getCurrentSilverPrice() {
    try {
      const currentPrice = await SilverPrice.findOne({ isActive: true })
        .sort({ lastUpdated: -1 });

      if (!currentPrice || this.isPriceStale(currentPrice.lastUpdated)) {
        // Fetch new price if no active price or price is stale
        const newPriceData = await this.fetchCurrentSilverPrice();
        return await this.saveSilverPrice(newPriceData);
      }

      return currentPrice;
    } catch (error) {
      console.error("Error getting current silver price:", error.message);
      throw error;
    }
  }

  // Get last known price (fallback)
  async getLastKnownPrice() {
    try {
      return await SilverPrice.findOne().sort({ lastUpdated: -1 });
    } catch (error) {
      console.error("Error getting last known price:", error.message);
      // Return default price if all else fails
      return {
        pricePerGram: 80, // Default price in INR
        currency: 'INR',
        source: 'default'
      };
    }
  }

  // Check if price is stale (older than update interval)
  isPriceStale(lastUpdated) {
    const now = new Date();
    const timeDiff = now - new Date(lastUpdated);
    return timeDiff > this.updateInterval;
  }

  // Calculate dynamic price for a product
  calculateDynamicPrice(silverWeight, laborPercentage = 0, gst = 18) {
    return new Promise(async (resolve, reject) => {
      try {
        const silverPrice = await this.getCurrentSilverPrice();
        
        const silverCost = silverWeight * silverPrice.pricePerGram;
        const laborCost = (laborPercentage / 100) * silverCost;
        const subtotal = silverCost + laborCost;
        const gstAmount = (gst / 100) * subtotal;
        const finalPrice = subtotal + gstAmount;

        resolve({
          breakdown: {
            silverWeight: silverWeight,
            silverPricePerGram: silverPrice.pricePerGram,
            silverCost: Math.round(silverCost * 100) / 100,
            laborPercentage: laborPercentage,
            laborCost: Math.round(laborCost * 100) / 100,
            subtotal: Math.round(subtotal * 100) / 100,
            gstPercentage: gst,
            gstAmount: Math.round(gstAmount * 100) / 100,
            finalPrice: Math.round(finalPrice * 100) / 100
          },
          finalPrice: Math.round(finalPrice * 100) / 100,
          lastUpdated: silverPrice.lastUpdated
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Start automatic price updates
  startAutomaticUpdates() {
    setInterval(async () => {
      try {
        console.log("Updating silver prices automatically...");
        const newPriceData = await this.fetchCurrentSilverPrice();
        await this.saveSilverPrice(newPriceData);
        console.log("Silver price updated successfully");
      } catch (error) {
        console.error("Error in automatic price update:", error.message);
      }
    }, this.updateInterval);
  }
}

module.exports = new SilverPriceService();
