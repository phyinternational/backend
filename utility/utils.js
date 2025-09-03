const mongoose = require("mongoose");
const ProductCategory = require("../models/product_category.model");

const getAllNestedSubcategories = async (categoryId) => {
  try {
    const allCategories = await ProductCategory.find(); // Fetch all categories
    const flatCategories = [];

    // Recursive function to add categories and subcategories to the flat array
    const addCategoriesToFlatArray = (categories, parentId = null) => {
      for (const category of categories) {
        if (String(category.parentId) === String(parentId)) {
          flatCategories.push(category);
          addCategoriesToFlatArray(categories, category._id);
        }
      }
    };

    // Call the recursive function to populate the flat array
    addCategoriesToFlatArray(allCategories);

    // Function to find nested subcategories for a specific category
    const findNestedSubcategories = (categoryId) => {
      const nestedSubcategories = [];

      for (const category of flatCategories) {
        if (String(category.parentId) === String(categoryId)) {
          nestedSubcategories.push(category);
          nestedSubcategories.push(...findNestedSubcategories(category._id));
        }
      }

      return nestedSubcategories;
    };

    // Call the nested subcategories function for the specified category
    const nestedSubcategories = findNestedSubcategories(categoryId);

    return nestedSubcategories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
};

module.exports = getAllNestedSubcategories;

