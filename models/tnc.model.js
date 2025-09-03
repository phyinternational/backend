const mongoose=require("mongoose");

const textSchema=mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    content:{
        type:String,
        required:true
    }

},{timestamps:true})

const textModel=mongoose.model('TextModel',textSchema);
module.exports=textModel;