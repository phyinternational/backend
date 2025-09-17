const axios = require('axios');
const SilverPrice = require("../models/silver-price.model");

class SilverPriceService {
  constructor() {
    // Set your API URL and key here (see below for provider info)
    this.apiUrl = process.env.SILVER_API_URL || "https://api.metalpriceapi.com/v1/latest";
    this.apiKey = process.env.SILVER_API_KEY || "YOUR_API_KEY_HERE";
    this.updateInterval = 1000 * 60 * 60 * 24; // 24 hours
    
    // Debug environment variables
    console.log('Silver API Config:');
    console.log('- API URL:', this.apiUrl);
    console.log('- API Key:', this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET');
    
    // To set manually, leave apiUrl/apiKey blank and only use saveSilverPrice
  }

  // Fetch current silver price from external API
  async fetchCurrentSilverPrice() {
    // Uses https://metalpriceapi.com/ (free tier available)
    // Sign up at https://metalpriceapi.com/ to get your API key
    // Set SILVER_API_URL and SILVER_API_KEY in your .env file
    try {
      if (!this.apiUrl || !this.apiKey || this.apiKey === "YOUR_API_KEY_HERE") {
        throw new Error("Silver price API URL or key not set. Set SILVER_API_URL and SILVER_API_KEY in your environment.");
      }
      // Use INR as base and XAG as currency for silver price in INR per troy ounce
      const response = await axios.get(this.apiUrl, {
        params: {
          api_key: this.apiKey,
          base: 'INR',
          currencies: 'XAG', // Silver symbol
        }
      });

      // Log the response for debugging
      console.log('Silver price API response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.success && response.data.rates) {
        let pricePerOunceINR;
        
        // Handle different response structures based on base currency
        if (response.data.rates.INRXAG) {
          // When base=INR, we get INRXAG which is INR per troy ounce
          pricePerOunceINR = response.data.rates.INRXAG;
        } else if (response.data.rates.XAG) {
          // Fallback: XAG rate (convert if needed)
          pricePerOunceINR = 1 / response.data.rates.XAG;
        } else {
          throw new Error("No silver rate found in API response");
        }
        
        // Convert from troy ounce to gram (1 troy ounce = 31.1035 grams)
        const pricePerGramINR = pricePerOunceINR / 31.1035;
        
        console.log(`Silver price calculation: ${pricePerOunceINR} INR/oz → ${pricePerGramINR} INR/gram`);
        
        return {
          pricePerGram: Math.round(pricePerGramINR * 100) / 100, // Round to 2 decimal places
          currency: 'INR',
          source: 'metalpriceapi'
        };
      }
      
      console.error('Invalid API response structure:', response.data);
      throw new Error("Invalid API response - missing rates.XAG");
    } catch (error) {
      console.error("Error fetching silver price:", error.message);
      if (error.response) {
        console.error("API Response Status:", error.response.status);
        console.error("API Response Data:", error.response.data);
      }
      // Return last known price if API fails
      return await this.getLastKnownPrice();
    }
  }

  // Save silver price to database
  async saveSilverPrice(priceData) {
    try {
      if (!priceData.pricePerGram) {
        throw new Error("pricePerGram is required to save silver price");
      }
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
      const last = await SilverPrice.findOne().sort({ lastUpdated: -1 });
      if (last && last.pricePerGram) {
        console.log('Using last known price from database:', last.pricePerGram);
        // Return plain object, not Mongoose document
        return {
          pricePerGram: last.pricePerGram,
          currency: last.currency || 'INR',
          source: last.source || 'database',
          lastUpdated: last.lastUpdated || new Date()
        };
      }
      // fallback with valid pricePerGram
      console.log('No valid price in database, using default fallback price');
      return {
        pricePerGram: 80, // Default price in INR
        currency: 'INR',
        source: 'default',
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error("Error getting last known price:", error.message);
      // Return default price if all else fails
      console.log('Database error, using emergency fallback price');
      return {
        pricePerGram: 80, // Default price in INR
        currency: 'INR',
        source: 'default',
        lastUpdated: new Date()
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
