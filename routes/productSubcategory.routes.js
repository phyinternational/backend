const { test, addSubCategory, getAllSubCategory, deleteSubCategory, getASubCategory, } = require("../controllers/product_varient.controller");

const router = require("express").Router();



router.get("/product/subcatagory/test", test);
router.post('/product/subcatagory/add', addSubCategory);
router.get('/product/subcatagory/all', getAllSubCategory);
router.delete('/product/subcatagory/delete/:id', deleteSubCategory);
router.get('/product/subcatagory/getasub/:id', getASubCategory);




module.exports = router;