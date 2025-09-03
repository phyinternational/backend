const { test, createText, getDataByName, editData, getAllData, deleteData } = require("../controllers/tnc.controller");

const router=require("express").Router();
const { requireAdminLogin } = require("../middlewares/requireLogin");


router.get("/api/content/test",test);
router.post("/api/content/create",requireAdminLogin,createText);
router.get("/api/content/getdata",getDataByName);
router.get('/api/content/getallcontent',getAllData);
router.put("/api/content/update/:id",requireAdminLogin,editData);
router.delete("/api/content/delete/:id",requireAdminLogin,deleteData);


module.exports=router;