const mongoose = require("mongoose");

const subCategorySchmea=mongoose.Schema({
    name:{
        type:String,
        required:true
    }
},{timestamps:true});

const subCategoryModel=mongoose.model("Subcategory",subCategorySchmea)
module.exports=subCategoryModel;