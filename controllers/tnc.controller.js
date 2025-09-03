const textDB = require('../models/tnc.model');
const asynchandler = require("express-async-handler");
const {
    errorRes,
    internalServerError,
    successRes,
} = require("../utility/index");
const test = async (req, res) => {
    successRes(res, '');
}


const createText = asynchandler(async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) {
        errorRes(res, 400, 'Invalid error ');
        return;
    }
    const newText = new textDB({
        name: name,
        content: content
    })
    const savedData = await newText.save();
    if (savedData) {
        successRes(res, savedData);

    }
    else {
        internalServerError(res, 'Error in saving data');
    }

})

const getAllData = asynchandler(async (req, res) => {
    const data = await textDB.find({});
    if (data) {
        successRes(res, data);
    }
    else {
        internalServerError(res, "Cannot retrive the datas");
    }
})
const getDataByName = asynchandler(async (req, res) => {
    const { name } = req.query;
    if (!name) {
        errorRes(res, 400, "Invalid query format");
        return;
    }
    const data = await textDB.findOne({ name: name });
    if (data) {
        successRes(res, data);
    }
    else {
        errorRes(res, 404, "Cannot found the data");
    }

})

const editData = asynchandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return errorRes(res, 400, 'Invalid parameter format');
    }
    const findData = await textDB({ _id: id });
    if (findData) {
        const { content } = req.body;
        const updateData = {};
        if (content) {
            updateData.content = content;
        }

        const updatedData = await textDB.findByIdAndUpdate({ _id: id }, updateData, { new: true });

        if (updatedData) {
            successRes(res, updatedData);
        }
        else {
            internalServerError(res, "Error in updating the data");
        }
    }
    else {
        errorRes(res, 404, 'Cannot found the data');
    }
})
const deleteData = asynchandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return errorRes(res, 400, 'Invalid parameter format');
    }
    const findData = await textDB({ _id: id });
    if (findData) {
        

        const deletedData = await textDB.findByIdAndDelete({ _id: id });

        if (deletedData) {
            successRes(res, deletedData);
        }
        else {
            internalServerError(res, "Error in deleting the data");
        }
    }
    else {
        errorRes(res, 404, 'Cannot found the data');
    }
})


module.exports = { test, createText,getAllData, getDataByName, editData ,deleteData};